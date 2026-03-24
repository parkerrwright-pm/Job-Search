// ─── Input Resolution Agent (Sub-Agent 1) ─────────────────────────────────────
// Responsible for fetching and resolving primary resume, template resume,
// job analysis data, and DOCX template buffers from the database.

import { PrismaClient } from '@prisma/client';
import { parsePrimaryResumeText } from './parsingAgent';

const prisma = new PrismaClient();

/**
 * Extract the selectedPrimaryResumeId stored in a job's customFields.
 */
export const extractSelectedPrimaryResumeId = (job: { customFields?: any } | null): string | undefined => {
  const cf = job?.customFields;
  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    const id = (cf as Record<string, any>).selectedPrimaryResumeId;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
};

/**
 * Fetch primary resume text. If resumeId is given, try that first; fall back to most recent.
 */
export const getPrimaryResumeText = async (userId: string, resumeId?: string): Promise<string> => {
  let resume: { fileName: string; fileUrl: string } | null | undefined;

  if (resumeId) {
    resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId, isPrimary: true },
      select: { fileName: true, fileUrl: true },
    });
  }

  if (!resume) {
    resume = await prisma.resume.findFirst({
      where: { userId, isPrimary: true },
      orderBy: { updatedAt: 'desc' },
      select: { fileName: true, fileUrl: true },
    });
  }

  if (!resume?.fileUrl) {
    return '';
  }

  try {
    return await parsePrimaryResumeText(resume.fileName, resume.fileUrl);
  } catch (error) {
    console.warn('Primary resume parsing failed:', error);
    return '';
  }
};

/**
 * Fetch the template (non-primary) resume record.
 */
export const getTemplateResume = async (userId: string) => {
  return prisma.resume.findFirst({
    where: {
      userId,
      isPrimary: false,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
    },
  });
};

/**
 * Fetch and parse template resume text.
 */
export const getTemplateResumeText = async (userId: string): Promise<{ fileName?: string; text: string }> => {
  const template = await getTemplateResume(userId);
  if (!template?.fileUrl) {
    return { text: '' };
  }

  try {
    const text = await parsePrimaryResumeText(template.fileName, template.fileUrl);
    return {
      fileName: template.fileName,
      text,
    };
  } catch (error) {
    console.warn('Template resume parsing failed:', error);
    return { fileName: template.fileName, text: '' };
  }
};

/**
 * Get the latest job analysis data from the database.
 */
export const getLatestJobAnalysisData = async (jobId: string): Promise<any | null> => {
  const latest = await prisma.jobAnalysis.findFirst({
    where: { jobId },
    orderBy: { updatedAt: 'desc' },
  });

  return latest?.analysisData || null;
};

/**
 * Get the DOCX template buffer (for merge rendering).
 */
export const getDocxTemplateBuffer = async (
  userId: string,
  templateResumeId?: string,
): Promise<{ fileName: string; buffer: Buffer } | null> => {
  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      isPrimary: true,
    },
  });

  const docxResumes = resumes.filter((resume) => {
    const fileName = resume.fileName.toLowerCase();
    const mime = (resume.mimeType || '').toLowerCase();
    return fileName.endsWith('.docx') || mime.includes('wordprocessingml.document');
  });

  const prioritizedResumes = templateResumeId
    ? [
        ...docxResumes.filter((resume) => resume.id === templateResumeId),
        ...docxResumes.filter((resume) => resume.id !== templateResumeId),
      ]
    : docxResumes;

  for (const resume of prioritizedResumes) {
    if (!resume.fileUrl || !resume.fileUrl.includes(',')) continue;
    try {
      const base64Data = resume.fileUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 0) {
        return { fileName: resume.fileName, buffer };
      }
    } catch (error) {
      console.warn(`Failed reading DOCX template buffer for ${resume.fileName}:`, error);
    }
  }

  return null;
};

/**
 * Compute a 1-5 star alignment rating: how well the user's primary resume
 * (enriched with LinkedIn profile data when available) matches the job description.
 * Runs synchronously before the response is sent.
 */
export const computeAlignmentRating = async (jobId: string, userId: string): Promise<void> => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { jobDescriptionText: true, title: true, company: true },
    });
    if (!job?.jobDescriptionText) {
      console.warn(`[AlignmentRating] Skipped for job ${jobId}: no job description text`);
      return;
    }

    const resumeText = await getPrimaryResumeText(userId);
    if (!resumeText) {
      console.warn(`[AlignmentRating] Skipped for job ${jobId}: no primary resume text`);
      return;
    }

    // Fetch cached LinkedIn profile data if available
    let linkedInSection = '';
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedinProfileData: true },
      });
      if (user?.linkedinProfileData) {
        const { buildLinkedInProfileSummary } = await import('../utils/linkedinScraper');
        const summary = buildLinkedInProfileSummary(user.linkedinProfileData as any);
        if (summary) {
          linkedInSection = `\n\nCANDIDATE LINKEDIN PROFILE:\n${summary.slice(0, 2000)}`;
        }
      }
    } catch (err) {
      // Non-fatal — proceed with resume only
      console.warn(`[AlignmentRating] LinkedIn profile fetch failed, continuing without:`, err);
    }

    const prompt = `You are an expert recruiter. Compare the candidate's resume${linkedInSection ? ' and LinkedIn profile' : ''} against the job description and rate alignment on a 1-5 scale.

Rating criteria:
1 = Poor fit - very few overlapping skills/experience
2 = Weak fit - some relevant experience but major gaps
3 = Moderate fit - meets many requirements but missing key qualifications
4 = Strong fit - meets most requirements with relevant experience
5 = Excellent fit - highly aligned skills, experience, and seniority level

${linkedInSection ? `When LinkedIn data is available, use it to gain additional context about the candidate's full career trajectory, endorsements, skills, certifications, and professional network that may not appear in the resume alone. This should provide a more accurate and comprehensive alignment assessment.` : ''}

JOB TITLE: ${job.title} at ${job.company}

JOB DESCRIPTION:
${job.jobDescriptionText.slice(0, 3000)}

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}${linkedInSection}

Respond with ONLY a single integer from 1 to 5. Nothing else.`;

    const { AIService } = await import('../utils/aiService');
    const response = await AIService.callOpenAI(prompt, undefined, 0.1);
    const content = response?.choices?.[0]?.message?.content?.trim() || '';
    const rating = parseInt(content, 10);

    if (rating >= 1 && rating <= 5) {
      await prisma.job.update({ where: { id: jobId }, data: { alignmentRating: rating } });
      console.log(`[AlignmentRating] Job ${jobId}: rated ${rating}/5${linkedInSection ? ' (with LinkedIn data)' : ''}`);
    } else {
      console.warn(`[AlignmentRating] Job ${jobId}: AI returned unparseable rating "${content}"`);
    }
  } catch (error) {
    console.warn(`[AlignmentRating] Failed for job ${jobId}:`, error);
  }
};
