import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, asyncHandler, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { detectAtsFromUrl } from '../utils/atsRulesDatabase';

// ─── Sub-Agent Architecture Imports ───────────────────────────────────────────
import {
  RESUME_OUTPUT_GENERATION_VERSION,
  TailoredResumeOutput,
  extractLocationFromDescription,
  extractSalaryFromDescription,
  extractPriorityFromDescription,
  extractCandidateName,
  buildExportFilename,
  isFallbackAnalysisData,
  analysisNeedsRefresh,
  buildFallbackAnalysisMessage,
  extractSelectedPrimaryResumeId,
  getPrimaryResumeText,
  getLatestJobAnalysisData,
  computeAlignmentRating,
  parseResumeStructureEnhanced,
  runJobWorkflowAnalysis,
  resolveQualityGateSnapshot,
  buildQualityGateFailureMessage,
  computePostSynthesisQualityGate,
  createTailoredResumeOutput,
  createPreviewResumeOutput,
  getOrCreateTailoredResumeOutput,
  getPreviewOutput,
  buildWordBuffer,
  buildPdfBuffer,
} from '../agents';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticate);


/**
 * GET /api/jobs/ai/diagnostics - Return current AI provider/model/key presence status
 */
router.get(
  '/ai/diagnostics',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const defaultOpenAiModel = 'gpt-5.4-mini';
    const defaultAnthropicModel = 'claude-opus-4-6';

    const providerRaw = (process.env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
    const provider = providerRaw === 'openai' ? 'openai' : 'anthropic';

    const openAiModel = (process.env.OPENAI_MODEL || defaultOpenAiModel).trim();
    const anthropicModel = (process.env.ANTHROPIC_MODEL || defaultAnthropicModel).trim();
    const openAiKeyPresent = Boolean((process.env.OPENAI_API_KEY || '').trim());
    const anthropicKeyPresent = Boolean((process.env.ANTHROPIC_API_KEY || '').trim());

    const effectiveModel = provider === 'anthropic' ? anthropicModel : openAiModel;
    const effectiveKeyPresent = provider === 'anthropic' ? anthropicKeyPresent : openAiKeyPresent;

    res.json({
      provider,
      effective: {
        model: effectiveModel,
        keyPresent: effectiveKeyPresent,
        ready: effectiveKeyPresent,
      },
      providers: {
        anthropic: {
          keyPresent: anthropicKeyPresent,
          model: anthropicModel,
          models: [
            'claude-opus-4-6',
            'claude-sonnet-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-haiku-20240307',
          ],
        },
        openai: {
          keyPresent: openAiKeyPresent,
          model: openAiModel,
          models: [
            'gpt-5.4',
            'gpt-5.4-mini',
            'gpt-5.3-codex',
            'o3',
            'gpt-4o-mini',
            'gpt-4o',
          ],
        },
      },
      generatedAt: new Date().toISOString(),
    });
  }),
);

/**
 * PUT /api/jobs/ai/diagnostics - Update AI provider/model at runtime
 */
router.put(
  '/ai/diagnostics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { provider, model } = req.body;

    const allowedProviders = ['anthropic', 'openai'];
    const allowedAnthropicModels = [
      'claude-opus-4-6',
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ];
    const allowedOpenAIModels = [
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.3-codex',
      'o3',
      'gpt-4o-mini',
      'gpt-4o',
    ];

    if (provider && !allowedProviders.includes(provider)) {
      res.status(400).json({ error: `Invalid provider. Allowed: ${allowedProviders.join(', ')}` });
      return;
    }

    if (provider) {
      process.env.AI_PROVIDER = provider;
    }

    if (model) {
      const resolvedProvider = provider || (process.env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
      const allowedModels = resolvedProvider === 'openai' ? allowedOpenAIModels : allowedAnthropicModels;
      if (!allowedModels.includes(model)) {
        res.status(400).json({ error: `Invalid model for ${resolvedProvider}. Allowed: ${allowedModels.join(', ')}` });
        return;
      }
      if (resolvedProvider === 'openai') {
        process.env.OPENAI_MODEL = model;
      } else {
        process.env.ANTHROPIC_MODEL = model;
      }
    }

    const currentProvider = (process.env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
    const effectiveModel = currentProvider === 'anthropic'
      ? (process.env.ANTHROPIC_MODEL || 'claude-opus-4-6').trim()
      : (process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim();
    const effectiveKeyPresent = currentProvider === 'anthropic'
      ? Boolean((process.env.ANTHROPIC_API_KEY || '').trim())
      : Boolean((process.env.OPENAI_API_KEY || '').trim());

    res.json({
      provider: currentProvider,
      effective: {
        model: effectiveModel,
        keyPresent: effectiveKeyPresent,
        ready: effectiveKeyPresent,
      },
      providers: {
        anthropic: {
          keyPresent: Boolean((process.env.ANTHROPIC_API_KEY || '').trim()),
          model: (process.env.ANTHROPIC_MODEL || 'claude-opus-4-6').trim(),
          models: allowedAnthropicModels,
        },
        openai: {
          keyPresent: Boolean((process.env.OPENAI_API_KEY || '').trim()),
          model: (process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim(),
          models: allowedOpenAIModels,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/jobs - List all jobs for user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { stage, priority, company, search } = req.query;

    const jobs = await prisma.job.findMany({
      where: {
        userId: req.userId!,
        ...(stage && { stage: stage as any }),
        ...(priority && { priority: priority as string }),
        ...(company && { company: { contains: company as string, mode: 'insensitive' } }),
        ...(search && {
          OR: [
            { title: { contains: search as string, mode: 'insensitive' } },
            { company: { contains: search as string, mode: 'insensitive' } },
            { notes: { contains: search as string, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        analyses: { take: 1, orderBy: { createdAt: 'desc' } },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json(jobs);
  })
);

/**
 * POST /api/jobs - Create new job
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      title,
      company,
      location,
      jobUrl,
      jobDescription,
      salary,
      stage,
      companyUrl,
      linkedinProfileUrl,
    } = req.body;

    if (!title || !company) {
      throw new AppError(400, 'Title and company are required');
    }

    const derivedLocation = location || extractLocationFromDescription(jobDescription);
    const derivedSalary = salary || extractSalaryFromDescription(jobDescription);
    const derivedPriority = extractPriorityFromDescription(jobDescription);

    // Detect ATS from job URL and include in customFields
    const detectedAts = detectAtsFromUrl(jobUrl || '');

    const job = await prisma.job.create({
      data: {
        userId: req.userId!,
        title,
        company,
        location: derivedLocation,
        jobUrl,
        jobDescriptionText: jobDescription,
        salary: derivedSalary,
        priority: derivedPriority,
        stage: stage || 'SAVED',
        customFields:
          companyUrl || linkedinProfileUrl || detectedAts !== 'Unknown'
            ? {
                companyUrl: companyUrl || undefined,
                linkedinProfileUrl: linkedinProfileUrl || undefined,
                ...(detectedAts !== 'Unknown' ? { detectedAtsSystem: detectedAts } : {}),
              }
            : undefined,
      },
    });

    // Compute alignment rating before responding so it's visible immediately
    if (jobDescription) {
      await computeAlignmentRating(job.id, req.userId!);
    }

    // Re-fetch to include the alignment rating
    const freshJob = await prisma.job.findUnique({ where: { id: job.id } });
    res.status(201).json(freshJob || job);
  })
);

/**
 * GET /api/jobs/:id - Get job details
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        analyses: { orderBy: { createdAt: 'desc' } },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    res.json(job);
  })
);

/**
 * PUT /api/jobs/:id - Update job
 */
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const {
      id,
      userId,
      createdAt,
      updatedAt,
      analyses,
      timeline,
      jobDescription,
      jobDescriptionText,
      salary,
      companyUrl,
      linkedinProfileUrl,
      ...rest
    } = req.body;
    const nextDescription = jobDescriptionText ?? jobDescription;
    const updateData: Record<string, any> = { ...rest };

    if (nextDescription !== undefined) {
      updateData.jobDescriptionText = nextDescription;
    }

    // Keep salary aligned with description when salary is empty or omitted.
    if (salary !== undefined || nextDescription !== undefined) {
      const explicitSalary =
        typeof salary === 'string' ? salary.trim() : salary;

      if (explicitSalary) {
        updateData.salary = explicitSalary;
      } else {
        const descriptionForExtraction =
          nextDescription ?? job.jobDescriptionText ?? undefined;
        const extractedSalary = extractSalaryFromDescription(descriptionForExtraction);
        updateData.salary = extractedSalary || null;
      }
    }

    const existingCustomFields =
      job.customFields && typeof job.customFields === 'object' && !Array.isArray(job.customFields)
        ? (job.customFields as Record<string, any>)
        : {};

    if (companyUrl !== undefined || linkedinProfileUrl !== undefined) {
      updateData.customFields = {
        ...existingCustomFields,
        ...(companyUrl !== undefined ? { companyUrl } : {}),
        ...(linkedinProfileUrl !== undefined ? { linkedinProfileUrl } : {}),
      };
    }

    // Detect ATS from job URL when jobUrl changes
    const effectiveJobUrl = updateData.jobUrl ?? job.jobUrl ?? '';
    const detectedAtsUpdate = detectAtsFromUrl(effectiveJobUrl);
    if (detectedAtsUpdate !== 'Unknown') {
      updateData.customFields = {
        ...existingCustomFields,
        ...(updateData.customFields || {}),
        detectedAtsSystem: detectedAtsUpdate,
      };
    }

    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Recompute alignment rating when JD changes, await so it's in the response
    if (updateData.jobDescriptionText) {
      await computeAlignmentRating(req.params.id, req.userId!);
    }

    // Re-fetch to include updated alignment rating
    const freshJob = await prisma.job.findUnique({ where: { id: req.params.id } });
    res.json(freshJob || updatedJob);
  })
);

/**
 * DELETE /api/jobs/:id - Delete job
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    await prisma.job.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

/**
 * PUT /api/jobs/:id/stage - Update job stage (Kanban board)
 */
router.put(
  '/:id/stage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { stage } = req.body;

    if (!stage) {
      throw new AppError(400, 'Stage is required');
    }

    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: { stage },
    });

    // Log timeline event
    await prisma.applicationTimeline.create({
      data: {
        jobId: req.params.id,
        event: `Moved to ${stage}`,
        stage,
      },
    });

    res.json(updatedJob);
  })
);

/**
 * GET /api/jobs/:id/timeline - Get application timeline
 */
router.get(
  '/:id/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const timeline = await prisma.applicationTimeline.findMany({
      where: { jobId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(timeline);
  })
);

/**
 * POST /api/jobs/:id/analyze - Generate comprehensive 20-section job analysis
 */
router.post(
  '/:id/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const analysis = await runJobWorkflowAnalysis(req.params.id, req.userId!);
    res.status(201).json(analysis);
  })
);

/**
 * GET /api/jobs/:id/analyze - Get latest analysis for job
 */
router.get(
  '/:id/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
    });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const analysis = await prisma.jobAnalysis.findFirst({
      where: { jobId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!analysis) {
      throw new AppError(404, 'No analysis found. Generate one using POST /api/jobs/:id/analyze');
    }

    res.json(analysis.analysisData);
  })
);

/**
 * GET /api/jobs/:id/workflow-status - Get quality gate and iteration status for latest analysis
 */
router.get(
  '/:id/workflow-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const latest = await prisma.jobAnalysis.findFirst({
      where: { jobId: job.id },
      orderBy: { updatedAt: 'desc' },
    });

    const workflow = (latest?.analysisData as any)?.workflow;
    if (!workflow) {
      return res.json({
        jobId: job.id,
        hasWorkflow: false,
        message: 'No workflow status available yet. Generate analysis first.',
      });
    }

    res.json({
      jobId: job.id,
      hasWorkflow: true,
      ...workflow,
    });
  }),
);

/**
 * POST /api/jobs/:id/outputs/generate - Generate tailored resume outputs for Word/PDF export
 */
router.post(
  '/:id/outputs/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const output = await createTailoredResumeOutput(req.params.id, req.userId!);
    res.status(201).json(output);
  })
);

/**
 * GET /api/jobs/:id/outputs/preview - Preview tailored resume output used by Word/PDF export
 */
router.get(
  '/:id/outputs/provider-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { output } = await getOrCreateTailoredResumeOutput(req.params.id, req.userId!);

    const provider = output.generationProvider || 'unknown';
    const source = output.generationSource || 'unknown';

    res.json({
      jobId: req.params.id,
      provider,
      source,
      model: output.generationModel || null,
      generatedAt: output.generatedAt || null,
      aiTailored: source === 'analysis-synthesis-ai',
    });
  })
);

/**
 * GET /api/jobs/:id/cached-preview - Return cached tailored resume if available (no AI calls)
 * Returns the latest cached RESUME_OUTPUT with fingerprint info for change detection.
 */
router.get(
  '/:id/cached-preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      select: { userId: true, customFields: true, selectedKeywords: true },
    });
    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }

    const cached = await prisma.aIAnalysis.findFirst({
      where: { userId: req.userId!, jobId: req.params.id, type: 'RESUME_OUTPUT', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!cached?.output) {
      res.json({ cached: false });
      return;
    }

    const cachedOutput = cached.output as unknown as TailoredResumeOutput;
    if (
      cachedOutput.generationVersion !== RESUME_OUTPUT_GENERATION_VERSION ||
      cachedOutput.generationSource !== 'analysis-synthesis-ai'
    ) {
      res.json({ cached: false });
      return;
    }

    const primaryResumeText = await getPrimaryResumeText(req.userId!, extractSelectedPrimaryResumeId(job));
    const parsedResume = parseResumeStructureEnhanced(primaryResumeText);
    const hasAiExperience = Array.isArray(cachedOutput.experience) && cachedOutput.experience.length > 0;

    const customFields =
      job.customFields && typeof job.customFields === 'object' && !Array.isArray(job.customFields)
        ? (job.customFields as Record<string, any>)
        : {};

    // Also load latest analysis data for missing keywords display
    const latestAnalysis = await getLatestJobAnalysisData(req.params.id);
    const missingKeywords = latestAnalysis?.sections?.missingKeywords || [];

    res.json({
      cached: true,
      ...cachedOutput,
      parsedResume,
      experienceSource: hasAiExperience ? 'ai-synthesis' : 'parsed-resume',
      missingKeywords,
      fingerprint: {
        primaryResumeId: customFields.selectedPrimaryResumeId || null,
        templateResumeId: customFields.selectedTemplateResumeId || null,
        selectedKeywords: job.selectedKeywords || [],
      },
    });
  })
);

/**
 * GET|POST /api/jobs/:id/outputs/preview
 * POST body (optional): { selectedKeywords: string[] }
 */
router.get(
  '/:id/outputs/preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { output, qualityGateMessage, qualityGate } = await getPreviewOutput(req.params.id, req.userId!);
    const previewJob = await prisma.job.findUnique({ where: { id: req.params.id }, select: { customFields: true } });
    const primaryResumeText = await getPrimaryResumeText(req.userId!, extractSelectedPrimaryResumeId(previewJob));
    const parsedResume = parseResumeStructureEnhanced(primaryResumeText);
    const hasAiExperience = Array.isArray(output.experience) && output.experience.length > 0;
    res.json({
      ...output,
      parsedResume,
      qualityGate,
      qualityGateMessage,
      experienceSource: hasAiExperience ? 'ai-synthesis' : 'parsed-resume',
    });
  })
);

router.post(
  '/:id/outputs/preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rawKeywords = req.body?.selectedKeywords;
    const selectedKeywords: string[] = Array.isArray(rawKeywords)
      ? rawKeywords.filter((k: any) => typeof k === 'string' && k.trim()).map((k: string) => k.trim())
      : [];

    // Persist selected keywords to the Job record
    if (selectedKeywords.length > 0) {
      await prisma.job.update({
        where: { id: req.params.id, userId: req.userId! },
        data: { selectedKeywords },
      });
    }

    const { output, qualityGateMessage, qualityGate } = await getPreviewOutput(
      req.params.id,
      req.userId!,
      selectedKeywords,
    );
    const postJob = await prisma.job.findUnique({ where: { id: req.params.id }, select: { customFields: true } });
    const primaryResumeText = await getPrimaryResumeText(req.userId!, extractSelectedPrimaryResumeId(postJob));
    const parsedResume = parseResumeStructureEnhanced(primaryResumeText);
    const hasAiExperience = Array.isArray(output.experience) && output.experience.length > 0;
    res.json({
      ...output,
      parsedResume,
      qualityGate,
      qualityGateMessage,
      experienceSource: hasAiExperience ? 'ai-synthesis' : 'parsed-resume',
      userSelectedKeywords: selectedKeywords,
    });
  })
);

/**
 * GET /api/jobs/:id/selected-keywords - Load persisted keyword selections for a job
 */
router.get(
  '/:id/selected-keywords',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      select: { selectedKeywords: true, userId: true },
    });
    if (!job || job.userId !== req.userId) {
      throw new AppError(404, 'Job not found');
    }
    res.json({ selectedKeywords: job.selectedKeywords || [] });
  })
);

/**
 * PUT /api/jobs/:id/selected-keywords - Save keyword selections for a job
 */
router.put(
  '/:id/selected-keywords',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rawKeywords = req.body?.selectedKeywords;
    const selectedKeywords: string[] = Array.isArray(rawKeywords)
      ? rawKeywords.filter((k: any) => typeof k === 'string' && k.trim()).map((k: string) => k.trim())
      : [];
    await prisma.job.update({
      where: { id: req.params.id, userId: req.userId! },
      data: { selectedKeywords },
    });
    res.json({ selectedKeywords });
  })
);

/**
 * GET /api/jobs/:id/outputs/word - Download tailored resume as Word (.docx)
 */
router.get(
  '/:id/outputs/word',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { output, qualityGateWarning } = await getOrCreateTailoredResumeOutput(req.params.id, req.userId!);
    const buffer = await buildWordBuffer(output, req.userId!, req.params.id);

    const wordJob = await prisma.job.findUnique({ where: { id: req.params.id }, select: { customFields: true } });
    const primaryText = await getPrimaryResumeText(req.userId!, extractSelectedPrimaryResumeId(wordJob));
    const candidateName = extractCandidateName(primaryText);
    const exportName = buildExportFilename(candidateName, output.targetRole, output.targetCompany, 'docx');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportName.replace(/[^\x20-\x7E]/g, '')}"`,
    );
    if (qualityGateWarning) {
      res.setHeader('X-Quality-Gate-Warning', 'true');
    }
    res.send(buffer);
  })
);

/**
 * GET /api/jobs/:id/outputs/pdf - Download tailored resume as PDF
 */
router.get(
  '/:id/outputs/pdf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { output, qualityGateWarning } = await getOrCreateTailoredResumeOutput(req.params.id, req.userId!);
    const buffer = await buildPdfBuffer(output, req.userId!, req.params.id);

    const pdfJob = await prisma.job.findUnique({ where: { id: req.params.id }, select: { customFields: true } });
    const primaryText = await getPrimaryResumeText(req.userId!, extractSelectedPrimaryResumeId(pdfJob));
    const candidateName = extractCandidateName(primaryText);
    const exportName = buildExportFilename(candidateName, output.targetRole, output.targetCompany, 'pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportName.replace(/[^\x20-\x7E]/g, '')}"`,
    );
    if (qualityGateWarning) {
      res.setHeader('X-Quality-Gate-Warning', 'true');
    }
    res.send(buffer);
  })
);

export default router;
