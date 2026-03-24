import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { AuthRequest, asyncHandler, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  AIService,
  WebSearchService,
  ResumeParsingService,
  PROMPTS_MAP,
} from '../utils/aiService';

const router = Router();
const prisma = new PrismaClient();

const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours

const isQuotaExceededError = (error: any): boolean => {
  const status = error?.status;
  const code = (error?.code || '').toString().toLowerCase();
  const message = (error?.message || '').toString().toLowerCase();

  return (
    status === 429 ||
    code.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    message.includes('insufficient_quota')
  );
};

const buildResumeTailorFallback = (resumeText: string, jobDescription: string) => {
  const tokens = (jobDescription || '')
    .split(/[^a-zA-Z0-9+#.-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 3);

  const missingKeywords = Array.from(new Set(tokens)).slice(0, 12);

  const bulletRewrites = (resumeText || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .filter((line) => !/@|linkedin|http|www\./i.test(line))
    .slice(0, 5);

  return {
    missingKeywords,
    bulletRewrites:
      bulletRewrites.length > 0
        ? bulletRewrites
        : [
            'Led cross-functional initiatives from discovery through launch with measurable impact.',
            'Defined roadmap priorities using customer insights, business goals, and technical constraints.',
            'Partnered with engineering and design to deliver user-centered improvements and business outcomes.',
          ],
    summaryRewrite:
      'Product-focused professional with experience translating customer needs into shipped outcomes. Resume tailoring was generated in fallback mode due to temporary AI quota limits.',
    skillsOptimization: missingKeywords.slice(0, 10),
    atsRecommendations: [
      'Re-run AI tailoring once API quota resets for deeper role-specific language improvements.',
      'Prioritize top job-description keywords in the summary, skills, and first 3 experience bullets.',
      'Add measurable outcomes (adoption, revenue, retention, efficiency) to strengthen ATS and recruiter scoring.',
    ],
    fallbackMode: 'quota-limited',
    generatedAt: new Date().toISOString(),
  };
};

const parseStoredResumeText = async (fileName: string, fileUrl: string): Promise<string> => {
  if (!fileUrl || !fileUrl.includes(',')) return '';

  const base64Data = fileUrl.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith('.pdf')) {
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    return pdfData.text || '';
  }

  if (lowerFileName.endsWith('.docx')) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  return '';
};

router.use(authenticate);

/**
 * POST /api/ai/analyze-job - Extract keywords from job description
 */
router.post(
  '/analyze-job',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { jobDescription, jobId } = req.body;

    if (!jobDescription) {
      throw new AppError(400, 'Job description is required');
    }

    // Check cache
    if (jobId) {
      const cached = await prisma.aIAnalysis.findFirst({
        where: {
          jobId,
          type: 'KEYWORD_EXTRACT',
          expiresAt: { gt: new Date() },
        },
      });

      if (cached) {
        return res.json(cached.output);
      }
    }

    // Call AI
    const result = await AIService.extractKeywords(jobDescription);

    // Store in cache
    if (jobId) {
      await prisma.aIAnalysis.create({
        data: {
          userId: req.userId!,
          jobId,
          type: 'KEYWORD_EXTRACT',
          inputData: { jobDescription },
          output: result,
          expiresAt: new Date(Date.now() + CACHE_DURATION),
        },
      });
    }

    res.json(result);
  })
);

/**
 * POST /api/ai/tailor-resume - Tailor resume for job
 */
router.post(
  '/tailor-resume',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { resume, jobDescription, jobId, primaryResumeId, templateResumeId } = req.body;

    let resolvedResume = typeof resume === 'string' ? resume : '';
    let resolvedJobDescription = typeof jobDescription === 'string' ? jobDescription : '';
    let resolvedTemplateText = '';
    let selectedJob: any = null;

    if (jobId) {
      selectedJob = await prisma.job.findUnique({ where: { id: jobId } });
      if (!selectedJob || selectedJob.userId !== req.userId) {
        throw new AppError(404, 'Selected job not found');
      }

      resolvedJobDescription = selectedJob.jobDescriptionText || resolvedJobDescription;
    }

    // Fetch primary resume — use specific ID if provided, else fall back to first primary
    if (!resolvedResume) {
      const primaryResume = primaryResumeId
        ? await prisma.resume.findUnique({ where: { id: primaryResumeId } })
        : await prisma.resume.findFirst({
            where: { userId: req.userId!, isPrimary: true },
            orderBy: { updatedAt: 'desc' },
          });

      if (!primaryResume || (primaryResumeId && primaryResume.userId !== req.userId)) {
        throw new AppError(400, 'A primary resume is required before tailoring a resume');
      }

      resolvedResume = await parseStoredResumeText(primaryResume.fileName, primaryResume.fileUrl);
    }

    // Fetch template resume text so the AI can consider its structure
    if (templateResumeId) {
      const templateResume = await prisma.resume.findUnique({ where: { id: templateResumeId } });
      if (templateResume && templateResume.userId === req.userId) {
        resolvedTemplateText = await parseStoredResumeText(templateResume.fileName, templateResume.fileUrl);
      }
    }

    if (jobId && templateResumeId) {
      const templateResume = await prisma.resume.findUnique({ where: { id: templateResumeId } });
      if (!templateResume || templateResume.userId !== req.userId) {
        throw new AppError(404, 'Selected resume template not found');
      }

      const existingJobCustomFields =
        selectedJob?.customFields &&
        typeof selectedJob.customFields === 'object' &&
        !Array.isArray(selectedJob.customFields)
          ? (selectedJob.customFields as Record<string, any>)
          : {};

      await prisma.job.update({
        where: { id: jobId },
        data: {
          customFields: {
            ...existingJobCustomFields,
            selectedTemplateResumeId: templateResumeId,
            selectedPrimaryResumeId: primaryResumeId || undefined,
          },
        },
      });
    }

    if (!resolvedResume || !resolvedJobDescription) {
      throw new AppError(400, 'A saved primary resume and saved job description are required');
    }

    const synthesis = await AIService.tailorResume(resolvedResume, resolvedJobDescription, resolvedTemplateText);
    const result = synthesis.data;

    // Store analysis
    await prisma.aIAnalysis.create({
      data: {
        userId: req.userId!,
        jobId: jobId || null,
        type: 'RESUME_TAILOR',
        inputData: {
          jobId: jobId || null,
          templateResumeId: templateResumeId || null,
          source: 'saved-job-and-primary-resume',
        },
        output: result,
        expiresAt: new Date(Date.now() + CACHE_DURATION),
      },
    });

    res.json({
      ...result,
      provider: synthesis.provider,
      model: synthesis.model,
      jobId: jobId || null,
      jobTitle: selectedJob?.title || null,
      company: selectedJob?.company || null,
      selectedTemplateResumeId: templateResumeId || null,
    });
  })
);

/**
 * POST /api/ai/ats-feedback - Re-run AI analysis with user feedback on ATS recommendations
 */
router.post(
  '/ats-feedback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { jobId, recommendations, feedback } = req.body;

    if (!jobId || !feedback?.trim()) {
      throw new AppError(400, 'Job ID and feedback text are required');
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const primaryResume = await prisma.resume.findFirst({
      where: { userId: req.userId!, isPrimary: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!primaryResume?.fileUrl) {
      throw new AppError(400, 'No primary resume found');
    }

    const resumeText = await parseStoredResumeText(primaryResume.fileName, primaryResume.fileUrl);

    const recsText = Array.isArray(recommendations)
      ? recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')
      : '';

    const prompt = `You are an expert ATS resume analyst. The user previously received these ATS optimization recommendations for their resume:

PREVIOUS RECOMMENDATIONS:
${recsText}

The user has provided this feedback about which recommendations are applicable and what changes they want:
USER FEEDBACK: ${feedback.trim()}

JOB DESCRIPTION:
${(job.jobDescriptionText || '').slice(0, 3000)}

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}

Based on the user's feedback, produce an UPDATED set of actionable ATS recommendations. Remove recommendations the user said are not applicable. Refine recommendations based on their input. Add any NEW recommendations based on their feedback.

Return as JSON with key: atsRecommendations (array of strings — each a specific, actionable recommendation).`;

    const response = await AIService.callOpenAI(prompt, undefined, 0.3);
    const content = (response.choices[0].message as any).content;
    let parsed: any;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { atsRecommendations: content.split('\n').filter((l: string) => l.trim()) };
    }

    res.json({
      atsRecommendations: parsed.atsRecommendations || [],
      provider: response.provider || 'unknown',
      model: response.model || null,
    });
  })
);

/**
 * POST /api/ai/company-research - Research company
 */
router.post(
  '/company-research',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { company, jobDescription } = req.body;

    if (!company) {
      throw new AppError(400, 'Company name is required');
    }

    // Check cache
    const cached = await prisma.researchCache.findUnique({
      where: {
        userId_company: {
          userId: req.userId!,
          company,
        },
      },
    });

    if (cached && cached.expiresAt > new Date()) {
      return res.json({
        overview: cached.overview,
        businessModel: cached.businessModel,
        productStrategy: cached.productStrategy,
        targetCustomers: cached.targetCustomers,
        competitors: cached.competitors,
        challenges: cached.challenges,
        opportunities: cached.opportunities,
      });
    }

    // Web search
    const searchResults = await WebSearchService.getCompanyInfo(company);

    // AI analysis
    const research = await AIService.researchCompany(
      company,
      searchResults.answerBox?.snippet || ''
    );

    // Cache results
    await prisma.researchCache.upsert({
      where: {
        userId_company: {
          userId: req.userId!,
          company,
        },
      },
      create: {
        userId: req.userId!,
        company,
        overview: research.overview,
        businessModel: research.businessModel,
        productStrategy: research.productStrategy,
        targetCustomers: research.targetCustomers,
        competitors: research.competitors || [],
        challenges: research.challenges,
        opportunities: research.opportunities,
        websiteUrl: searchResults.knowledgeGraph?.website,
        expiresAt: new Date(Date.now() + CACHE_DURATION),
      },
      update: {
        overview: research.overview,
        businessModel: research.businessModel,
        productStrategy: research.productStrategy,
        targetCustomers: research.targetCustomers,
        competitors: research.competitors || [],
        challenges: research.challenges,
        opportunities: research.opportunities,
        expiresAt: new Date(Date.now() + CACHE_DURATION),
      },
    });

    res.json(research);
  })
);

/**
 * POST /api/ai/interview-prep - Generate interview prep
 */
router.post(
  '/interview-prep',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { company, role, resumeHighlights } = req.body;

    if (!company || !role) {
      throw new AppError(400, 'Company and role are required');
    }

    const result = await AIService.generateInterviewPrep(
      company,
      role,
      resumeHighlights || ''
    );

    // Store prep materials
    await prisma.interviewPrep.create({
      data: {
        userId: req.userId!,
        title: `${role} at ${company}`,
        company,
        questions: result.behavioralQuestions || [],
        stories: result.storyBank || [],
        productQuestions: result.productQuestions || [],
        notes: result.mockTips || '',
      },
    });

    res.json(result);
  })
);

/**
 * POST /api/ai/networking-message - Generate networking message
 */
router.post(
  '/networking-message',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      recipientName,
      recipientRole,
      recipientType,
      company,
      jobRole,
      userBackground,
    } = req.body;

    if (!recipientName || !company) {
      throw new AppError(400, 'Recipient name and company are required');
    }

    const message = await AIService.generateNetworkingMessage(
      recipientName,
      recipientRole || '',
      company,
      jobRole || '',
      userBackground || ''
    );

    // Store message
    await prisma.networkingMessage.create({
      data: {
        userId: req.userId!,
        recipientType: recipientType || 'RECRUITER',
        recipientName,
        company,
        role: jobRole,
        shortMessage: message.shortMessage,
        longMessage: message.longMessage,
      },
    });

    res.json(message);
  })
);

/**
 * POST /api/ai/ats-score - Score resume with ATS simulation
 */
router.post(
  '/ats-score',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { resume, jobDescription } = req.body;

    if (!resume || !jobDescription) {
      throw new AppError(400, 'Resume and job description are required');
    }

    const score = await AIService.scoreResume(resume, jobDescription);

    res.json(score);
  })
);

/**
 * POST /api/ai/linkedin-optimizer - Optimize LinkedIn profile
 */
router.post(
  '/linkedin-optimizer',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { role, targetRoles, background, skills } = req.body;

    if (!role || !targetRoles) {
      throw new AppError(400, 'Role and target roles are required');
    }

    const optimization = await AIService.optimizeLinkedIn(
      role,
      targetRoles,
      background || '',
      skills || ''
    );

    res.json(optimization);
  })
);

/**
 * POST /api/ai/recruiter-search-optimize - Optimize for recruiter search
 */
router.post(
  '/recruiter-search-optimize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { resume, targetRole, targetIndustry } = req.body;

    const prompt = `Analyze this resume and create a list of:
1. Keywords recruiters search for in "${targetRole}" roles
2. How this resume ranks (0-100) for that search
3. Missing signals that would improve search ranking
4. Recommended keywords to add

Return as JSON with keys: recruiterKeywords, rankingScore, missingSignals, recommendedKeywords.

Resume:
${resume}

Target Role: ${targetRole}
Target Industry: ${targetIndustry}`;

    const response = await AIService.callOpenAI(prompt) as OpenAI.ChatCompletion;
    const content = (response.choices[0].message as any).content;
    const result = JSON.parse(content);

    res.json(result);
  })
);

export default router;
