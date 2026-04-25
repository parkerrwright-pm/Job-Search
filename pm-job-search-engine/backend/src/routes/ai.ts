import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { AuthRequest, asyncHandler, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  AIService,
  WebSearchService,
  ResumeParsingService,
  PROMPTS_MAP,
} from '../utils/aiService';
import { appendAboutMeContext } from '../utils/aboutMeProfile';
import { createResearchDeck } from '../agents/researchDeckAgent';

const router = Router();
const prisma = new PrismaClient();

const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours

const RESEARCH_DECK_TYPE = 'RESEARCH_DECK';
const INTERVIEW_PREP_STAGES = ['PHONE_SCREEN', 'RECRUITER_SCREEN', 'HIRING_MANAGER', 'PANEL', 'FINAL'];

const normalizeInterviewType = (value: any): string | null => {
  const candidate = String(value || '').trim().toUpperCase();
  return INTERVIEW_PREP_STAGES.includes(candidate) ? candidate : null;
};

const getVersionNumber = (metrics: any): number => {
  const candidate = Number(metrics?.versionNumber || 0);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 0;
};

const toVersionSummary = (analysis: any) => ({
  id: analysis.id,
  createdAt: analysis.createdAt,
  versionNumber: getVersionNumber(analysis.metrics),
  hasUserPrompt: Boolean((analysis.inputData as any)?.userPrompt),
});

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

const LOCAL_EVIDENCE_FILES = [
  '/Users/parkerwright/Desktop/ChatPRD-Export-2026-04-13T19-34-36.txt',
  '/Users/parkerwright/Desktop/ChatPRD-Export-2026-04-13T20-07-06.txt',
  '/Users/parkerwright/Desktop/ChatPRD-Stakeholder-Reviews-2026-04-13T20-07-26Z.txt',
  '/Users/parkerwright/Desktop/ChatPRD-Stakeholder-Reviews-2026-04-13T20-07-41Z.txt',
  '/Users/parkerwright/Desktop/ChatPRD-Export-2026-04-14T23-41-35.txt',
];

const normalizeText = (value: string): string => {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const clampText = (value: string, maxLength: number): string => {
  const normalized = normalizeText(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trim()}…` : normalized;
};

const dedupeStrings = (values: string[]): string[] => {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
};

const buildCompanyResearchText = async (company: string, companyUrl: string): Promise<string> => {
  const snippets: string[] = [];

  try {
    const companyInfo = await WebSearchService.getCompanyInfo(company);
    snippets.push(companyInfo?.answerBox?.snippet || '');
    snippets.push(companyInfo?.knowledgeGraph?.description || '');

    const organicResults = Array.isArray(companyInfo?.organic)
      ? companyInfo.organic
      : Array.isArray(companyInfo?.results)
        ? companyInfo.results
        : [];

    organicResults.slice(0, 4).forEach((item: any) => {
      snippets.push(item?.snippet || '');
    });
  } catch (error) {
    console.warn('Company info research unavailable:', error);
  }

  try {
    const newsQuery = companyUrl
      ? `${company} ${companyUrl} latest company news product funding leadership`
      : `${company} latest company news product funding leadership`;
    const newsResults = await WebSearchService.searchSerper(newsQuery);
    const organicNews = Array.isArray(newsResults?.organic)
      ? newsResults.organic
      : Array.isArray(newsResults?.news)
        ? newsResults.news
        : [];

    organicNews.slice(0, 4).forEach((item: any) => {
      const title = item?.title ? `${item.title}: ` : '';
      snippets.push(`${title}${item?.snippet || ''}`);
    });
  } catch (error) {
    console.warn('Company news research unavailable:', error);
  }

  return clampText(dedupeStrings(snippets).join('\n\n'), 2400);
};

const buildAccomplishmentEvidenceText = async (): Promise<string> => {
  const keywordPattern = /(ichra|funding|subsidy|stakeholder review|acceptance criteria|release notice|approved|product manager|api|participant|qualification|alignment|launch|delivery)/i;
  const paragraphs: string[] = [];

  for (const filePath of LOCAL_EVIDENCE_FILES) {
    try {
      const raw = await readFile(filePath, 'utf8');
      const chunks = normalizeText(raw).split(/\n\n+/g);
      chunks.forEach((chunk) => {
        if (chunk.length >= 60 && keywordPattern.test(chunk)) {
          paragraphs.push(chunk);
        }
      });
    } catch (error) {
      console.warn(`Local evidence file unavailable: ${filePath}`, error);
    }
  }

  return clampText(dedupeStrings(paragraphs).slice(0, 12).join('\n\n'), 3200);
};

const parseInterviewPrepNotes = (value: string | null | undefined): Record<string, any> => {
  const notes = String(value || '').trim();
  if (!notes.startsWith('{')) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const DEFAULT_STAR_QUESTION_BANK = {
  behavioral: [
    'Tell me about a time you had to influence stakeholders without direct authority',
    'Describe a situation where you had to pivot your product strategy based on new information',
    'How do you handle competing priorities from different stakeholder groups?',
    'Give me an example of how you have used data to challenge conventional thinking',
  ],
  product: [
    "How would you prioritize API integrations for this platform?",
    'What metrics would you track for a multi-sided benefits administration platform?',
    'How would you approach technical debt in a fast-growing SaaS environment?',
    'Describe your process for translating business requirements into technical specifications',
  ],
  company: [
    'How would you leverage your benefits administration expertise in this role?',
    'What opportunities do you see for automation in the broker-employer-employee ecosystem?',
    'How does this multi-sided platform compare to your experience at WTW?',
    'What would your 90-day plan look like for understanding API strategy?',
  ],
} as const;

const simplifyConversational = (value: any, maxSentences: number = 2, maxLength: number = 280): string => {
  const normalized = normalizeText(String(value || ''));
  if (!normalized) return '';

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const concise = (sentences.slice(0, maxSentences).join(' ') || normalized).trim();
  return concise.length > maxLength ? `${concise.slice(0, maxLength).trim()}...` : concise;
};

const extractLegacyAnswerText = (item: any): string => {
  if (!item || typeof item !== 'object') {
    return '';
  }

  return simplifyConversational(
    item.sampleAnswer || item.answerFramework || item.answer || item.result || item.relevance || item.talkTrack || '',
    3,
    420,
  );
};

const inferPrepCategory = (questionText: string): 'behavioral' | 'product' | 'company' => {
  const question = String(questionText || '').toLowerCase();

  if (/(tell me about|time you|without direct authority|competing priorities|challenge conventional|stakeholder)/i.test(question)) {
    return 'behavioral';
  }

  if (/(prioritize|metric|api|technical debt|requirements|specification|roadmap|tradeoff)/i.test(question)) {
    return 'product';
  }

  return 'company';
};

const normalizeStar = (rawStar: any, fallbackAnswer: string) => {
  const fallback = simplifyConversational(fallbackAnswer, 2, 260);

  const situation = simplifyConversational(rawStar?.situation || rawStar?.context || '', 2, 220)
    || 'A complex benefits workflow needed clearer execution and alignment.';
  const task = simplifyConversational(rawStar?.task || rawStar?.goal || '', 2, 220)
    || 'I needed to align stakeholders and deliver a reliable outcome quickly.';
  const action = simplifyConversational(rawStar?.action || rawStar?.actions || fallback, 2, 280)
    || 'I translated business needs into clear requirements, aligned partners, and drove delivery.';
  const result = simplifyConversational(rawStar?.result || rawStar?.outcome || fallback, 2, 280)
    || 'We improved user clarity, reduced manual work, and shipped with stronger confidence.';

  return { situation, task, action, result };
};

const normalizeAnsweredItem = (
  item: any,
  index: number,
  sectionLabel: 'behavioral' | 'product' | 'company',
  questionAnswerPairs: any[],
) => {
  const question = simplifyConversational(
    typeof item === 'string'
      ? item
      : item?.question || item?.prompt || item?.title || '',
    1,
    220,
  ) || `${sectionLabel.toUpperCase()} question ${index + 1}`;

  const pairMatch = questionAnswerPairs.find((pair) => {
    const pairQuestion = String(pair?.question || pair?.prompt || '').toLowerCase();
    const normalizedQuestion = String(question || '').toLowerCase();
    return pairQuestion && (pairQuestion.includes(normalizedQuestion.slice(0, 24)) || normalizedQuestion.includes(pairQuestion.slice(0, 24)));
  });

  const legacyAnswer = extractLegacyAnswerText(item) || extractLegacyAnswerText(pairMatch);
  const star = normalizeStar(item?.star, legacyAnswer);
  const talkTrack = simplifyConversational(item?.talkTrack || legacyAnswer || `${star.action} ${star.result}`, 4, 420)
    || `${star.action} ${star.result}`;

  return {
    question,
    star,
    talkTrack,
  };
};

const buildFallbackAnsweredItems = (
  sectionLabel: 'behavioral' | 'product' | 'company',
  questionAnswerPairs: any[],
  existingCount: number,
): any[] => {
  const categorizedPairs = questionAnswerPairs.filter((pair) => {
    const pairQuestion = String(pair?.question || pair?.prompt || '');
    return inferPrepCategory(pairQuestion) === sectionLabel;
  });

  const pairSource = categorizedPairs.length ? categorizedPairs : questionAnswerPairs;
  const fallbackItems: any[] = [];

  for (const pair of pairSource) {
    if (existingCount + fallbackItems.length >= 4) break;
    fallbackItems.push(normalizeAnsweredItem(pair, existingCount + fallbackItems.length, sectionLabel, questionAnswerPairs));
  }

  const defaultQuestions = DEFAULT_STAR_QUESTION_BANK[sectionLabel];
  for (const defaultQuestion of defaultQuestions) {
    if (existingCount + fallbackItems.length >= 4) break;

    fallbackItems.push(
      normalizeAnsweredItem(
        {
          question: defaultQuestion,
          talkTrack:
            'Use a concise example from your benefits platform work, then connect it directly to this role and the expected outcome.',
        },
        existingCount + fallbackItems.length,
        sectionLabel,
        questionAnswerPairs,
      )
    );
  }

  return fallbackItems;
};

const normalizeAnsweredSection = (
  items: any,
  sectionLabel: 'behavioral' | 'product' | 'company',
  questionAnswerPairs: any[],
): any[] => {
  const rawItems = Array.isArray(items) ? items : [];
  const normalizedItems = rawItems
    .map((item, index) => normalizeAnsweredItem(item, index, sectionLabel, questionAnswerPairs))
    .filter((item) => Boolean(item.question));

  if (normalizedItems.length < 4) {
    normalizedItems.push(...buildFallbackAnsweredItems(sectionLabel, questionAnswerPairs, normalizedItems.length));
  }

  return normalizedItems.slice(0, 6);
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
    const { company, role, resumeHighlights, jobId, interviewType, contextPrompt } = req.body;

    let resolvedCompany = String(company || '').trim();
    let resolvedRole = String(role || '').trim();
    let resolvedInterviewType = normalizeInterviewType(interviewType);
    let jobDescription = '';
    let companyUrl = '';

    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job || job.userId !== req.userId) {
        throw new AppError(404, 'Job not found');
      }

      const stageType = normalizeInterviewType(job.stage);
      if (!stageType) {
        throw new AppError(
          400,
          'Interview prep is available only for PHONE_SCREEN, RECRUITER_SCREEN, HIRING_MANAGER, PANEL, or FINAL stages'
        );
      }

      resolvedInterviewType = resolvedInterviewType || stageType;
      resolvedCompany = resolvedCompany || String(job.company || '').trim();
      resolvedRole = resolvedRole || String(job.title || '').trim();
      jobDescription = String(job.jobDescriptionText || '').trim();

      const customFields =
        job.customFields && typeof job.customFields === 'object' && !Array.isArray(job.customFields)
          ? (job.customFields as Record<string, any>)
          : {};

      companyUrl = String(customFields.companyUrl || job.jobUrl || '').trim();
    }

    if (!resolvedCompany || !resolvedRole) {
      throw new AppError(400, 'Company and role are required');
    }

    if (!resolvedInterviewType) {
      throw new AppError(400, 'interviewType must be one of PHONE_SCREEN, RECRUITER_SCREEN, HIRING_MANAGER, PANEL, FINAL');
    }

    let resolvedResumeHighlights = String(resumeHighlights || '').trim();
    if (!resolvedResumeHighlights) {
      const primaryResume = await prisma.resume.findFirst({
        where: { userId: req.userId!, isPrimary: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (primaryResume?.fileUrl) {
        resolvedResumeHighlights = await parseStoredResumeText(primaryResume.fileName, primaryResume.fileUrl);
      }
    }

    resolvedResumeHighlights = await appendAboutMeContext(resolvedResumeHighlights);

    const [companyResearch, accomplishmentEvidence] = await Promise.all([
      buildCompanyResearchText(resolvedCompany, companyUrl),
      buildAccomplishmentEvidenceText(),
    ]);

    const result = await AIService.generateInterviewPrep(
      resolvedCompany,
      resolvedRole,
      resolvedResumeHighlights,
      resolvedInterviewType,
      String(contextPrompt || ''),
      jobDescription,
      companyUrl,
      companyResearch,
      accomplishmentEvidence,
    );

    const questionAnswerPairs = Array.isArray(result?.questionAnswerPairs) ? result.questionAnswerPairs : [];
    const normalizedBehavioralQuestions = normalizeAnsweredSection(result?.behavioralQuestions, 'behavioral', questionAnswerPairs);
    const normalizedProductQuestions = normalizeAnsweredSection(result?.productQuestions, 'product', questionAnswerPairs);
    const normalizedCompanyQuestions = normalizeAnsweredSection(result?.companyQuestions, 'company', questionAnswerPairs);

    const normalizedResult = {
      ...result,
      interviewType: resolvedInterviewType,
      overview: result?.overview ? String(result.overview) : '',
      evidenceHighlights: Array.isArray(result?.evidenceHighlights)
        ? result.evidenceHighlights.map((item: any) => String(item || '').trim()).filter(Boolean)
        : [],
      researchHighlights: Array.isArray(result?.researchHighlights)
        ? result.researchHighlights.map((item: any) => String(item || '').trim()).filter(Boolean)
        : [],
      questionAnswerPairs,
      behavioralQuestions: normalizedBehavioralQuestions,
      productQuestions: normalizedProductQuestions,
      companyQuestions: normalizedCompanyQuestions,
      storyBank: Array.isArray(result?.storyBank) ? result.storyBank : [],
      mockTips: result?.mockTips ? String(result.mockTips) : '',
    };

    const storedNotes = JSON.stringify({
      interviewType: normalizedResult.interviewType,
      overview: normalizedResult.overview,
      evidenceHighlights: normalizedResult.evidenceHighlights,
      researchHighlights: normalizedResult.researchHighlights,
      behavioralQuestions: normalizedResult.behavioralQuestions,
      productQuestions: normalizedResult.productQuestions,
      companyQuestions: normalizedResult.companyQuestions,
      mockTips: normalizedResult.mockTips,
    });

    const resources = [
      ...(jobId ? [`jobId:${jobId}`] : []),
      `interviewType:${resolvedInterviewType}`,
    ];

    // Store prep materials
    const saved = await prisma.interviewPrep.create({
      data: {
        userId: req.userId!,
        title: `${resolvedRole} at ${resolvedCompany}`,
        company: resolvedCompany,
        questions: normalizedResult.questionAnswerPairs.length
          ? normalizedResult.questionAnswerPairs
          : normalizedResult.behavioralQuestions,
        stories: normalizedResult.storyBank,
        productQuestions: normalizedResult.productQuestions,
        notes: storedNotes,
        resources,
      },
    });

    res.json({
      prep: normalizedResult,
      prepMeta: {
        id: saved.id,
        createdAt: saved.createdAt,
        interviewType: resolvedInterviewType,
        jobId: jobId || null,
      },
    });
  })
);

/**
 * GET /api/ai/interview-prep/:jobId - Fetch latest interview prep for a job
 */
router.get(
  '/interview-prep/:jobId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { jobId } = req.params;
    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const prepRecords = await prisma.interviewPrep.findMany({
      where: {
        userId: req.userId!,
        resources: {
          has: `jobId:${jobId}`,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const extractType = (record: any) => {
      const typeTag = Array.isArray(record?.resources)
        ? record.resources.find((entry: string) => String(entry).startsWith('interviewType:'))
        : null;
      const typeValue = typeTag ? String(typeTag).split(':')[1] : '';
      return normalizeInterviewType(typeValue) || normalizeInterviewType(job.stage) || 'HIRING_MANAGER';
    };

    const toPrepPayload = (record: any) => {
      const parsedNotes = parseInterviewPrepNotes(record?.notes);
      const parsedQuestionAnswerPairs = Array.isArray(record?.questions) ? record.questions : [];
      const parsedBehavioral = normalizeAnsweredSection(
        Array.isArray(parsedNotes.behavioralQuestions) ? parsedNotes.behavioralQuestions : parsedQuestionAnswerPairs,
        'behavioral',
        parsedQuestionAnswerPairs,
      );
      const parsedProduct = normalizeAnsweredSection(
        Array.isArray(parsedNotes.productQuestions) ? parsedNotes.productQuestions : record?.productQuestions,
        'product',
        parsedQuestionAnswerPairs,
      );
      const parsedCompany = normalizeAnsweredSection(
        Array.isArray(parsedNotes.companyQuestions) ? parsedNotes.companyQuestions : [],
        'company',
        parsedQuestionAnswerPairs,
      );

      return {
        interviewType: parsedNotes.interviewType || extractType(record),
        overview: parsedNotes.overview ? String(parsedNotes.overview) : '',
        evidenceHighlights: Array.isArray(parsedNotes.evidenceHighlights) ? parsedNotes.evidenceHighlights : [],
        researchHighlights: Array.isArray(parsedNotes.researchHighlights) ? parsedNotes.researchHighlights : [],
        questionAnswerPairs: parsedQuestionAnswerPairs,
        behavioralQuestions: parsedBehavioral,
        productQuestions: parsedProduct,
        companyQuestions: parsedCompany,
        storyBank: Array.isArray(record?.stories) ? record.stories : [],
        mockTips: parsedNotes.mockTips ? String(parsedNotes.mockTips) : String(record?.notes || ''),
      };
    };

    const currentStageType = normalizeInterviewType(job.stage);
    const currentStagePrep = currentStageType
      ? prepRecords.find((record) => extractType(record) === currentStageType)
      : null;
    const latest = currentStagePrep || prepRecords[0];

    res.json({
      jobId,
      hasPrep: Boolean(latest),
      hasCurrentStagePrep: Boolean(currentStagePrep),
      prep: latest ? toPrepPayload(latest) : null,
      versions: prepRecords.map((record) => ({
        id: record.id,
        createdAt: record.createdAt,
        interviewType: extractType(record),
      })),
    });
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

/**
 * POST /api/ai/generate-research-deck - Generate or update CTO-ready research deck for a job
 */
router.post(
  '/generate-research-deck',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { jobId, userPrompt, extensionTechData } = req.body;

    if (!jobId) {
      throw new AppError(400, 'jobId is required');
    }

    const normalizedPrompt = String(userPrompt || '').trim();
    const normalizedExtensionData = String(extensionTechData || '').trim();
    const hasUpdateInput = Boolean(normalizedPrompt || normalizedExtensionData);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    if (job.stage !== 'HIRING_MANAGER') {
      throw new AppError(400, 'Research deck generation is available only for HIRING_MANAGER stage jobs');
    }

    const latestDeck = await prisma.aIAnalysis.findFirst({
      where: {
        userId: req.userId!,
        jobId,
        type: RESEARCH_DECK_TYPE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestDeck && !hasUpdateInput) {
      return res.json({
        deck: latestDeck.output,
        fromCache: true,
        updated: false,
        jobId,
        latestVersion: toVersionSummary(latestDeck),
      });
    }

    const nextVersionNumber = getVersionNumber(latestDeck?.metrics) + 1 || 1;

    const deck = await createResearchDeck({
      job,
      userPrompt: normalizedPrompt,
      extensionTechData: normalizedExtensionData,
      priorDeck: latestDeck?.output || null,
    });

    const saved = await prisma.aIAnalysis.create({
      data: {
        userId: req.userId!,
        jobId,
        type: RESEARCH_DECK_TYPE,
        inputData: {
          userPrompt: normalizedPrompt,
          extensionTechData: normalizedExtensionData,
          basedOnAnalysisId: latestDeck?.id || null,
          updateRequested: hasUpdateInput,
        },
        output: deck,
        metrics: {
          versionNumber: nextVersionNumber,
          updatedFromPrevious: Boolean(latestDeck),
          generatedFromInput: hasUpdateInput,
        },
        expiresAt: new Date(Date.now() + CACHE_DURATION),
      },
    });

    res.json({
      deck,
      fromCache: false,
      updated: Boolean(latestDeck),
      jobId,
      latestVersion: toVersionSummary(saved),
    });
  })
);

/**
 * GET /api/ai/research-deck/:jobId - Fetch latest research deck and version metadata
 */
router.get(
  '/research-deck/:jobId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { jobId } = req.params;
    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const analyses = await prisma.aIAnalysis.findMany({
      where: {
        userId: req.userId!,
        jobId,
        type: RESEARCH_DECK_TYPE,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const latest = analyses[0];

    res.json({
      deck: latest?.output || null,
      hasDeck: Boolean(latest),
      jobId,
      latestVersion: latest ? toVersionSummary(latest) : null,
      versions: analyses.map(toVersionSummary),
    });
  })
);

export default router;
