// ─── Export Synthesis Agent (Sub-Agent 6) ─────────────────────────────────────
// Responsible for building TailoredResumeOutput from analysis data and AI synthesis.

import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import {
  TailoredResumeOutput,
  RESUME_OUTPUT_GENERATION_VERSION,
} from './types';
import {
  normalizeStringList,
  normalizeExperienceEntries,
  normalizeEducationEntries,
  isQuotaExceededError,
  isFallbackAnalysisData,
  analysisNeedsRefresh,
  buildFallbackAnalysisMessage,
} from './shared';
import {
  extractSelectedPrimaryResumeId,
  getPrimaryResumeText,
  getTemplateResumeText,
  getLatestJobAnalysisData,
} from './inputResolutionAgent';
import { parseResumeStructureEnhanced } from './parsingAgent';
import {
  resolveQualityGateSnapshot,
  buildQualityGateFailureMessage,
  computePostSynthesisQualityGate,
  extractAtsScoreFromAnalysis,
} from './qualityGateAgent';
import { detectAtsFromUrl } from '../utils/atsRulesDatabase';

const prisma = new PrismaClient();

// ── Analysis-derived helpers ──────────────────────────────────────────────────

const parseSummaryFromOptions = (summaryOptions?: string): string => {
  if (!summaryOptions || typeof summaryOptions !== 'string') return '';

  const cleaned = summaryOptions
    .replace(/\b(STARTUP-FOCUSED|ENTERPRISE-FOCUSED|BALANCED)\b:?/gi, '')
    .replace(/\bOption\s*\d+\s*:/gi, '')
    .trim();

  const paragraphs = cleaned
    .split(/\n{2,}|(?=\d+\.)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40);

  return paragraphs[0] || cleaned;
};

const parseSkillsFromSection = (skillsSection?: string): string[] => {
  if (!skillsSection || typeof skillsSection !== 'string') return [];

  return skillsSection
    .split(/\n|,|;/)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter((item) => item.length >= 2)
    .filter((item) => item.length <= 50)
    .filter((item) => !/@|linkedin|http/i.test(item))
    .slice(0, 20);
};

const parseExperienceBulletsFromAnalysis = (bulletRewrites: any): string[] => {
  if (!bulletRewrites || typeof bulletRewrites !== 'object') return [];

  const roles = Array.isArray(bulletRewrites.roles) ? bulletRewrites.roles : [];
  const bullets = roles
    .flatMap((role: any) => (Array.isArray(role?.bullets) ? role.bullets : []))
    .map((bullet: any) => (typeof bullet === 'string' ? bullet.trim() : ''))
    .filter((bullet: string) => bullet.length > 20)
    .filter((bullet: string) => !/@|linkedin|http/i.test(bullet));

  return bullets.slice(0, 10);
};

const parseKeywordsFromMissingKeywords = (missingKeywords?: string): string[] => {
  if (!missingKeywords || typeof missingKeywords !== 'string') return [];
  return missingKeywords
    .split(/\n|,|;/)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter((item) => item.length >= 2)
    .slice(0, 12);
};

/**
 * Derive a partial TailoredResumeOutput from raw analysis sections.
 */
export const buildOutputFromJobAnalysis = (
  analysisData: any,
): Partial<TailoredResumeOutput> => {
  const sections = analysisData?.sections || {};
  if (!sections || typeof sections !== 'object') return {};

  const summary = parseSummaryFromOptions(sections.summaryOptions);
  const skills = parseSkillsFromSection(sections.skillsSection);
  const experienceBullets = parseExperienceBulletsFromAnalysis(sections.bulletRewrites);
  const keywordsAdded = parseKeywordsFromMissingKeywords(sections.missingKeywords);

  const atsRecommendations = [
    ...normalizeStringList(sections?.atsVmockScore?.recommendations),
    ...normalizeStringList(sections?.atsVmockScore?.gaps),
  ].slice(0, 8);

  return {
    summary,
    skills,
    experienceBullets,
    keywordsAdded,
    atsRecommendations,
  };
};

export const analysisHasAiGeneratedContent = (analysisData: any): boolean => {
  if (!analysisData || typeof analysisData !== 'object') return false;

  if (analysisData?.meta?.generatedWithAiPrompts === true) return true;
  if (analysisData?.meta?.usedFallbackContent === true) return false;

  const derived = buildOutputFromJobAnalysis(analysisData);
  const signalCount = [
    typeof derived.summary === 'string' && derived.summary.trim().length >= 80,
    Array.isArray(derived.skills) && derived.skills.length >= 6,
    Array.isArray(derived.experienceBullets) && derived.experienceBullets.length >= 4,
    Array.isArray(derived.keywordsAdded) && derived.keywordsAdded.length >= 5,
    Array.isArray(derived.atsRecommendations) && derived.atsRecommendations.length >= 3,
  ].filter(Boolean).length;

  return signalCount >= 2;
};

export const hasUsefulAnalysisDerivedContent = (analysisDerived: Partial<TailoredResumeOutput>): boolean => {
  return Boolean(
    (analysisDerived.summary && analysisDerived.summary.trim().length >= 40) ||
      (Array.isArray(analysisDerived.skills) && analysisDerived.skills.length >= 4) ||
      (Array.isArray(analysisDerived.experienceBullets) && analysisDerived.experienceBullets.length >= 3),
  );
};

export const buildQuotaFallbackOutput = (
  jobTitle: string,
  company: string,
  resumeText: string,
  jobDescription: string,
): TailoredResumeOutput => {
  const jdTokens = (jobDescription || '')
    .split(/[^a-zA-Z0-9+#.-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 3);
  const uniqueKeywords = Array.from(new Set(jdTokens)).slice(0, 12);

  const resumeLines = (resumeText || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .filter((line) => !line.includes('@'))
    .filter((line) => !/linkedin|http|www\./i.test(line))
    .filter((line) => !/\b\d{3}[-.)\s]?\d{3}[-.\s]?\d{4}\b/.test(line))
    .slice(0, 6);

  const skills = uniqueKeywords.slice(0, 10);
  const experienceBullets =
    resumeLines.length > 0
      ? resumeLines.slice(0, 5)
      : [
          'Led cross-functional product initiatives from discovery through launch with measurable impact.',
          'Defined roadmap priorities using customer insights, business goals, and delivery constraints.',
          'Collaborated with engineering, design, and stakeholders to ship high-quality product improvements.',
        ];

  return {
    headline: `${jobTitle} | Product Strategy | Execution Excellence`,
    summary:
      `Product-focused candidate with proven ability to deliver outcomes in ${company}. ` +
      'This export was generated using fallback mode due to temporary AI quota limits.',
    skills,
    experience: [],
    education: [],
    certifications: [],
    experienceBullets,
    keywordsAdded: uniqueKeywords.slice(0, 8),
    atsRecommendations: [
      'Re-run AI tailoring once quota resets for stronger language optimization.',
      'Ensure top JD keywords appear in summary, skills, and first 3 experience bullets.',
      'Quantify impact with metrics where possible (adoption, revenue, retention, efficiency).',
    ],
    generatedAt: new Date().toISOString(),
    targetRole: jobTitle,
    targetCompany: company,
    generationVersion: RESUME_OUTPUT_GENERATION_VERSION,
    generationSource: 'quota-fallback',
    fallbackMode: 'quota-limited',
  };
};

// ── Primary export synthesis functions ────────────────────────────────────────

/**
 * Generate a full TailoredResumeOutput for Word/PDF export (enforces quality gate).
 */
export const createTailoredResumeOutput = async (
  jobId: string,
  userId: string,
  analysisDataOverride?: any,
): Promise<TailoredResumeOutput> => {
  const { AIService } = await import('../utils/aiService');
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job || job.userId !== userId) {
    throw new AppError(404, 'Job not found');
  }

  let resumeText = await getPrimaryResumeText(userId, extractSelectedPrimaryResumeId(job));
  if (!resumeText) {
    resumeText =
      'No resume content provided. Create a high-quality PM resume tailored to this job description with ATS optimization.';
  }

  const templateResumeData = await getTemplateResumeText(userId);

  let latestAnalysisData = analysisDataOverride || (await getLatestJobAnalysisData(job.id));
  if (analysisNeedsRefresh(latestAnalysisData)) {
    // Import orchestrator lazily to avoid circular deps
    const { runJobWorkflowAnalysis } = await import('./analysisCoordinatorAgent');
    latestAnalysisData = await runJobWorkflowAnalysis(job.id, userId);
  }

  if (isFallbackAnalysisData(latestAnalysisData)) {
    throw new AppError(503, buildFallbackAnalysisMessage());
  }

  const qualityGate = resolveQualityGateSnapshot(latestAnalysisData);
  if (!qualityGate.passed) {
    throw new AppError(422, buildQualityGateFailureMessage(latestAnalysisData, qualityGate));
  }

  const analysisDerived = buildOutputFromJobAnalysis(latestAnalysisData);

  const parsedPrimaryExport = parseResumeStructureEnhanced(resumeText);
  const primarySkillsExport = parsedPrimaryExport.skills || [];

  let tailored: any;
  let output: TailoredResumeOutput;

  try {
    const baselineScore = latestAnalysisData?.workflow?.baselineAtsScore || 0;
    const detectedAts = latestAnalysisData?.atsRulesApplied?.system
      || detectAtsFromUrl(job.jobUrl || '')
      || 'Unknown';
    const synthesis = await AIService.synthesizeResumeExport(
      resumeText,
      job.jobDescriptionText || '',
      latestAnalysisData,
      job.title,
      job.company,
      templateResumeData.text || '',
      baselineScore,
      [],
      primarySkillsExport,
      detectedAts,
    );
    tailored = synthesis.data;

    const summary = (typeof tailored?.summary === 'string' ? tailored.summary.trim() : '').replace(/\u2014/g, ',');
    const skills = normalizeStringList(tailored?.skills);
    const keywordsAdded = normalizeStringList(tailored?.keywordsAdded);
    const atsRecommendations = normalizeStringList(tailored?.atsRecommendations);
    const headline = typeof tailored?.headline === 'string' ? tailored.headline.trim() : '';
    const experience = normalizeExperienceEntries(tailored?.experience);
    const education = normalizeEducationEntries(tailored?.education);
    const certifications = normalizeStringList(tailored?.certifications);
    const experienceBullets = experience.length > 0
      ? experience.flatMap(e => e.bullets)
      : normalizeStringList(tailored?.experienceBullets);

    output = {
      headline: headline || `${job.title} | Product Strategy | Data-Driven Execution`,
      summary: summary || analysisDerived.summary || '',
      skills: skills.length ? skills : analysisDerived.skills || [],
      experience,
      education,
      certifications,
      experienceBullets:
        experienceBullets.length
          ? experienceBullets
          : analysisDerived.experienceBullets || [],
      keywordsAdded: keywordsAdded.length ? keywordsAdded : analysisDerived.keywordsAdded || [],
      atsRecommendations:
        atsRecommendations.length ? atsRecommendations : analysisDerived.atsRecommendations || [],
      generatedAt: new Date().toISOString(),
      targetRole: job.title,
      targetCompany: job.company,
      generationVersion: RESUME_OUTPUT_GENERATION_VERSION,
      generationSource: 'analysis-synthesis-ai',
      generationProvider: synthesis.provider || 'openai',
      generationModel: synthesis.model || null,
    };
  } catch (error: any) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }

    throw new AppError(
      503,
      'AI resume generation is currently unavailable (OpenAI quota limit). No fallback resume will be exported. Restore quota and regenerate for true AI-tailored output.',
    );
  }

  await prisma.aIAnalysis.create({
    data: {
      userId,
      jobId,
      type: 'RESUME_OUTPUT',
      inputData: {
        jobTitle: job.title,
        company: job.company,
        jobDescriptionText: job.jobDescriptionText || '',
      },
      output,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  return output;
};

/**
 * Preview-only resume output generator — skips the quality gate check.
 */
export const createPreviewResumeOutput = async (
  jobId: string,
  userId: string,
  analysisDataOverride?: any,
  selectedKeywords: string[] = [],
): Promise<TailoredResumeOutput> => {
  const { AIService } = await import('../utils/aiService');
  const job = await prisma.job.findUnique({ where: { id: jobId } });

  if (!job || job.userId !== userId) {
    throw new AppError(404, 'Job not found');
  }

  let resumeText = await getPrimaryResumeText(userId, extractSelectedPrimaryResumeId(job));
  if (!resumeText) {
    resumeText =
      'No resume content provided. Create a high-quality PM resume tailored to this job description with ATS optimization.';
  }

  const templateResumeData = await getTemplateResumeText(userId);

  let latestAnalysisData = analysisDataOverride || (await getLatestJobAnalysisData(job.id));
  if (!latestAnalysisData || analysisNeedsRefresh(latestAnalysisData)) {
    throw new AppError(400, 'No job analysis available. Please click "Generate Tailored Resume" first.');
  }

  if (isFallbackAnalysisData(latestAnalysisData)) {
    throw new AppError(503, buildFallbackAnalysisMessage());
  }

  const analysisDerived = buildOutputFromJobAnalysis(latestAnalysisData);

  const parsedPrimary = parseResumeStructureEnhanced(resumeText);
  const primarySkills = parsedPrimary.skills || [];

  let tailored: any;
  let output: TailoredResumeOutput;

  try {
    const baselineScorePreview = latestAnalysisData?.workflow?.baselineAtsScore || 0;
    const detectedAtsPreview = latestAnalysisData?.atsRulesApplied?.system
      || detectAtsFromUrl(job.jobUrl || '')
      || 'Unknown';
    const synthesis = await AIService.synthesizeResumeExport(
      resumeText,
      job.jobDescriptionText || '',
      latestAnalysisData,
      job.title,
      job.company,
      templateResumeData.text || '',
      baselineScorePreview,
      selectedKeywords,
      primarySkills,
      detectedAtsPreview,
    );
    tailored = synthesis.data;

    const summary = (typeof tailored?.summary === 'string' ? tailored.summary.trim() : '').replace(/\u2014/g, ',');
    const skills = normalizeStringList(tailored?.skills);
    const keywordsAdded = normalizeStringList(tailored?.keywordsAdded);
    const atsRecommendations = normalizeStringList(tailored?.atsRecommendations);
    const headline = typeof tailored?.headline === 'string' ? tailored.headline.trim() : '';
    const experience = normalizeExperienceEntries(tailored?.experience);
    const education = normalizeEducationEntries(tailored?.education);
    const certifications = normalizeStringList(tailored?.certifications);
    const experienceBullets = experience.length > 0
      ? experience.flatMap(e => e.bullets)
      : normalizeStringList(tailored?.experienceBullets);

    output = {
      headline: headline || `${job.title} | Product Strategy | Data-Driven Execution`,
      summary: summary || analysisDerived.summary || '',
      skills: skills.length ? skills : analysisDerived.skills || [],
      experience,
      education,
      certifications,
      experienceBullets:
        experienceBullets.length
          ? experienceBullets
          : analysisDerived.experienceBullets || [],
      keywordsAdded: keywordsAdded.length ? keywordsAdded : analysisDerived.keywordsAdded || [],
      atsRecommendations:
        atsRecommendations.length ? atsRecommendations : analysisDerived.atsRecommendations || [],
      generatedAt: new Date().toISOString(),
      targetRole: job.title,
      targetCompany: job.company,
      generationVersion: RESUME_OUTPUT_GENERATION_VERSION,
      generationSource: 'analysis-synthesis-ai',
      generationProvider: synthesis.provider || 'openai',
      generationModel: synthesis.model || null,
    };
  } catch (error: any) {
    console.error(`[Preview Synthesis FAILED] Error: ${error.message}`);
    console.error(`[Preview Synthesis FAILED] Stack: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
    output = {
      headline: `${job.title} | ${job.company}`,
      summary: analysisDerived.summary || '',
      skills: analysisDerived.skills || [],
      experience: [],
      education: [],
      certifications: [],
      experienceBullets: analysisDerived.experienceBullets || [],
      keywordsAdded: analysisDerived.keywordsAdded || [],
      atsRecommendations: analysisDerived.atsRecommendations || [],
      generatedAt: new Date().toISOString(),
      targetRole: job.title,
      targetCompany: job.company,
      generationVersion: RESUME_OUTPUT_GENERATION_VERSION,
      generationSource: 'analysis-derived-fallback',
      generationProvider: 'unknown',
      generationModel: null,
    };
    console.error(`Preview generation AI call failed, using analysis-derived fallback: ${error.message}`);
  }

  try {
    await prisma.aIAnalysis.create({
      data: {
        userId,
        jobId,
        type: 'RESUME_OUTPUT',
        inputData: {
          source: 'preview-synthesis',
          selectedKeywords,
        },
        output: output as any,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
  } catch (cacheErr) {
    console.warn('[Preview Cache] Failed to cache preview output:', cacheErr);
  }

  return output;
};

/**
 * Get or create tailored resume output (with caching).
 */
export const getOrCreateTailoredResumeOutput = async (
  jobId: string,
  userId: string,
): Promise<{ output: TailoredResumeOutput; qualityGateWarning: string | null }> => {
  let latestAnalysisData = await getLatestJobAnalysisData(jobId);
  if (analysisNeedsRefresh(latestAnalysisData)) {
    const { runJobWorkflowAnalysis } = await import('./analysisCoordinatorAgent');
    latestAnalysisData = await runJobWorkflowAnalysis(jobId, userId);
  }

  if (isFallbackAnalysisData(latestAnalysisData)) {
    throw new AppError(503, buildFallbackAnalysisMessage());
  }

  const qualityGate = resolveQualityGateSnapshot(latestAnalysisData);
  const qualityGateWarning = qualityGate.passed
    ? null
    : buildQualityGateFailureMessage(latestAnalysisData, qualityGate);

  if (qualityGateWarning) {
    console.warn(
      `[Export] Quality gate not met (ATS ${qualityGate.atsScore}/${qualityGate.minAtsScore}, ` +
      `AI ${qualityGate.aiReviewerScore}/${qualityGate.minAiReviewerScore}) — ` +
      `proceeding with synthesis. Gate scores reflect PRIMARY resume, not tailored output.`,
    );
  }

  const cached = await prisma.aIAnalysis.findFirst({
    where: {
      userId,
      jobId,
      type: 'RESUME_OUTPUT',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (cached?.output) {
    const cachedOutput = cached.output as unknown as TailoredResumeOutput;
    if (
      cachedOutput.generationVersion === RESUME_OUTPUT_GENERATION_VERSION &&
      cachedOutput.generationSource === 'analysis-synthesis-ai'
    ) {
      return { output: cachedOutput, qualityGateWarning };
    }
  }

  const output = await createTailoredResumeOutput(jobId, userId, latestAnalysisData);
  return { output, qualityGateWarning };
};

/**
 * Preview-specific variant that never blocks on quality gate failure.
 */
export const getPreviewOutput = async (
  jobId: string,
  userId: string,
  selectedKeywords: string[] = [],
): Promise<{ output: TailoredResumeOutput; qualityGateMessage: string | null; qualityGate: import('./types').QualityGateSnapshot }> => {
  const latestAnalysisData = await getLatestJobAnalysisData(jobId);
  if (!latestAnalysisData || analysisNeedsRefresh(latestAnalysisData)) {
    throw new AppError(400, 'No job analysis found. Please click "Generate Tailored Resume" first to run the AI analysis before previewing or applying keywords.');
  }

  if (isFallbackAnalysisData(latestAnalysisData)) {
    throw new AppError(503, buildFallbackAnalysisMessage());
  }

  const preGate = resolveQualityGateSnapshot(latestAnalysisData);

  if (selectedKeywords.length === 0) {
    const cached = await prisma.aIAnalysis.findFirst({
      where: { userId, jobId, type: 'RESUME_OUTPUT', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (cached?.output) {
      const cachedOutput = cached.output as unknown as TailoredResumeOutput;
      if (
        cachedOutput.generationVersion === RESUME_OUTPUT_GENERATION_VERSION &&
        cachedOutput.generationSource === 'analysis-synthesis-ai'
      ) {
        const qualityGate = computePostSynthesisQualityGate(latestAnalysisData, cachedOutput, preGate);
        const qualityGateMessage = qualityGate.passed
          ? null
          : buildQualityGateFailureMessage(latestAnalysisData, qualityGate);
        return { output: cachedOutput, qualityGateMessage, qualityGate };
      }
    }
  }

  const output = await createPreviewResumeOutput(jobId, userId, latestAnalysisData, selectedKeywords);
  const qualityGate = computePostSynthesisQualityGate(latestAnalysisData, output, preGate);
  const qualityGateMessage = qualityGate.passed
    ? null
    : buildQualityGateFailureMessage(latestAnalysisData, qualityGate);
  return { output, qualityGateMessage, qualityGate };
};
