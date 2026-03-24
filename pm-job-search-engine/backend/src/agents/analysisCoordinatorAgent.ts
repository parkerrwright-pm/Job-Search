// ─── AI Analysis Coordinator Agent (Sub-Agent 4) ──────────────────────────────
// Responsible for orchestrating the multi-iteration AI analysis workflow loop.

import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import {
  WorkflowGateConfig,
  WorkflowScoreEntry,
  SupportingArchitectureStatus,
} from './types';
import {
  extractSelectedPrimaryResumeId,
  getPrimaryResumeText,
  getTemplateResumeText,
} from './inputResolutionAgent';
import {
  parseResumeStructureEnhanced,
  parseJobDescriptionStructure,
  buildParsedContextBlock,
} from './parsingAgent';
import {
  parseWorkflowGateConfig,
  extractAtsScoreFromAnalysis,
  computeAiReviewerScore,
  buildRefinementContext,
} from './qualityGateAgent';
import {
  detectAtsFromUrl,
  getAtsScoreThreshold,
  getATSRules,
  formatATSRulesForPrompt,
} from '../utils/atsRulesDatabase';

const prisma = new PrismaClient();

const buildSupportingArchitectureStatus = (
  workflowGate: WorkflowGateConfig,
  templateResume: { fileName?: string; text: string },
): SupportingArchitectureStatus => {
  const hasTemplate = Boolean(templateResume.fileName);
  return {
    promptTemplateLibrary: { connected: true, source: 'backend/src/utils/jobAnalysisPrompts.ts' },
    resumeTemplateStore: {
      connected: true,
      templateFound: hasTemplate,
      templateFileName: templateResume.fileName,
    },
    atsRulesDatabase: { connected: true, version: 'ats-rules-v1', source: 'backend/src/utils/atsRulesDatabase.ts', systems: ['Greenhouse', 'Workday', 'Lever', 'iCIMS', 'Taleo'] },
    qualityGateConfig: {
      connected: true,
      minAtsScore: workflowGate.minAtsScore,
      minAiReviewerScore: workflowGate.minAiReviewerScore,
      maxIterations: workflowGate.maxIterations,
    },
    sessionStateStore: { connected: true, mechanism: 'jwt-auth + browser localStorage' },
    exportEngine: { connected: true, word: true, pdf: true },
    auditObservability: { connected: true, analysisRunLogging: true, scoreHistory: true },
    errorHandling: { connected: true, gracefulFallback: true },
    securityLayer: { connected: true, authRequired: true },
  };
};

/**
 * Run the full multi-iteration AI analysis workflow for a job.
 * This is the main orchestration loop: parse -> analyze -> score -> refine -> repeat.
 */
export const runJobWorkflowAnalysis = async (jobId: string, userId: string) => {
  const { AIService } = await import('../utils/aiService');

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== userId) {
    throw new AppError(404, 'Job not found');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      linkedinUrl: true,
      aiPreferences: true,
      resumes: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const customFields =
    job.customFields && typeof job.customFields === 'object' && !Array.isArray(job.customFields)
      ? (job.customFields as Record<string, any>)
      : {};

  let resumeText = await getPrimaryResumeText(userId, extractSelectedPrimaryResumeId(job));
  if (!resumeText) {
    resumeText =
      'No resume content was provided. Generate analysis based only on the job details and provide generally applicable output.';
  }

  const templateResume = await getTemplateResumeText(userId);
  const workflowGate = parseWorkflowGateConfig((user as any)?.aiPreferences);

  const companyUrl = (customFields.companyUrl as string) || job.jobUrl || '';
  const linkedinInput =
    (customFields.linkedinProfileUrl as string) || (user as any)?.linkedinUrl || undefined;

  // Phase 2: Parsing & Extraction
  const parsedResume = parseResumeStructureEnhanced(resumeText);
  const parsedJD = parseJobDescriptionStructure(job.jobDescriptionText || '');
  const parsedContextBlock = buildParsedContextBlock(parsedResume, parsedJD);

  console.log(
    `[Phase 2] Resume parsed: ${parsedResume.workEntries.length} roles, ${parsedResume.skills.length} skills, ${parsedResume.certifications.length} certs. ` +
    `JD parsed: ${parsedJD.requiredSkills.length} required, ${parsedJD.preferredSkills.length} preferred, seniority=${parsedJD.seniorityLevel}, exp=${parsedJD.experienceYears}`,
  );

  const scoreHistory: WorkflowScoreEntry[] = [];
  let finalAnalysis: any = null;
  let passed = false;
  let workingResumeText = `${resumeText}\n\n${parsedContextBlock}`;

  // Phase 3: ATS Detection
  let detectedATSSystem = detectAtsFromUrl(job.jobUrl || '');

  if (detectedATSSystem !== 'Unknown') {
    const atsThreshold = getAtsScoreThreshold(detectedATSSystem);
    workflowGate.minAtsScore = Math.max(workflowGate.minAtsScore, atsThreshold);
    console.log(`[ATS Detection] Detected "${detectedATSSystem}" from URL — minAtsScore set to ${workflowGate.minAtsScore}`);
  } else {
    console.log('[ATS Detection] No ATS detected from URL — will use AI detection after iteration 1');
  }

  // Best-version tracking
  let bestAnalysis: any = null;
  let bestAtsScore = 0;
  let baselineAtsScore = 0;

  // Phase 4: Multi-iteration analysis loop
  for (let iteration = 1; iteration <= workflowGate.maxIterations; iteration += 1) {
    const startedAt = Date.now();

    const analysis = await AIService.comprehensiveJobAnalysis(
      job.id,
      job.title,
      job.company,
      companyUrl,
      job.jobDescriptionText || '',
      job.jobUrl || '',
      workingResumeText,
      linkedinInput,
      templateResume.text || undefined,
    );

    // After iteration 1, capture the detected ATS system
    if (iteration === 1) {
      if (detectedATSSystem === 'Unknown') {
        const atsDetection = analysis?.sections?.atsSystemDetection;
        const aiDetected =
          atsDetection?.detectedATS || atsDetection?.detectedSystem || atsDetection?.system || 'Unknown';
        if (aiDetected !== 'Unknown') {
          detectedATSSystem = aiDetected;
          const atsThreshold = getAtsScoreThreshold(detectedATSSystem);
          workflowGate.minAtsScore = Math.max(workflowGate.minAtsScore, atsThreshold);
          console.log(`[ATS Detection] AI detected "${detectedATSSystem}" — minAtsScore updated to ${workflowGate.minAtsScore}`);
        }
      }
    }

    const atsScore = extractAtsScoreFromAnalysis(analysis);
    const aiReviewerScore = computeAiReviewerScore(analysis);
    const iterationPassed =
      atsScore >= workflowGate.minAtsScore && aiReviewerScore >= workflowGate.minAiReviewerScore;
    const durationMs = Date.now() - startedAt;

    scoreHistory.push({
      iteration,
      atsScore,
      aiReviewerScore,
      passed: iterationPassed,
      durationMs,
      generatedAt: new Date().toISOString(),
    });

    await prisma.aIAnalysis.create({
      data: {
        userId,
        jobId: job.id,
        type: 'JOB_ANALYSIS_RUN',
        inputData: {
          iteration,
          maxIterations: workflowGate.maxIterations,
          minAtsScore: workflowGate.minAtsScore,
          minAiReviewerScore: workflowGate.minAiReviewerScore,
          truthfulnessGuardrail: workflowGate.truthfulnessGuardrail,
          templateResumeFile: templateResume.fileName || null,
        },
        output: {
          sectionsPresent: Object.keys(analysis?.sections || {}).length,
        },
        metrics: {
          atsScore,
          aiReviewerScore,
          passed: iterationPassed,
          durationMs,
        },
        score: atsScore,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    if (atsScore >= bestAtsScore) {
      bestAnalysis = analysis;
      bestAtsScore = atsScore;
    }

    if (iteration === 1) {
      baselineAtsScore = atsScore;
      console.log(`[Quality Gate] Baseline ATS score (primary resume): ${baselineAtsScore}/100`);
    }

    finalAnalysis = analysis;
    if (iterationPassed) {
      passed = true;
      break;
    }

    if (iteration < workflowGate.maxIterations) {
      const refinement = buildRefinementContext(analysis, iteration, baselineAtsScore);
      const atsRules = getATSRules(detectedATSSystem);
      const atsRulesContext = formatATSRulesForPrompt(atsRules);
      workingResumeText = `${resumeText}\n\n${parsedContextBlock}\n\n${refinement}\n\n${atsRulesContext}`;
    }
  }

  // Use the best-scoring iteration
  if (bestAnalysis && bestAtsScore > extractAtsScoreFromAnalysis(finalAnalysis)) {
    console.log(
      `[Quality Gate] Using best iteration (score ${bestAtsScore}) instead of last ` +
      `(score ${extractAtsScoreFromAnalysis(finalAnalysis)})`,
    );
    finalAnalysis = bestAnalysis;
  }

  const lastEntry = scoreHistory[scoreHistory.length - 1];
  finalAnalysis = {
    ...finalAnalysis,
    parsedInputs: {
      resume: {
        name: parsedResume.name,
        skillsExtracted: parsedResume.skills.length,
        rolesExtracted: parsedResume.workEntries.length,
        hasSummary: Boolean(parsedResume.summary),
        hasCertifications: parsedResume.certifications.length > 0,
      },
      jobDescription: {
        seniorityLevel: parsedJD.seniorityLevel,
        experienceYears: parsedJD.experienceYears,
        requiredSkillsCount: parsedJD.requiredSkills.length,
        preferredSkillsCount: parsedJD.preferredSkills.length,
        responsibilitiesCount: parsedJD.responsibilities.length,
        domainKeywordsTop: parsedJD.domainKeywords.slice(0, 10),
      },
    },
    atsRulesApplied: {
      system: detectedATSSystem || 'Unknown',
      rulesVersion: 'ats-rules-v1',
      detectedFrom: detectedATSSystem !== 'Unknown'
        ? (detectAtsFromUrl(job.jobUrl || '') !== 'Unknown' ? 'url-pattern' : 'ai-detection')
        : 'none',
      minAtsScore: workflowGate.minAtsScore,
    },
    workflow: {
      qualityGate: workflowGate,
      scoreHistory,
      iterationsRun: scoreHistory.length,
      passed,
      baselineAtsScore,
      bestIterationAtsScore: bestAtsScore,
      finalAtsScore: extractAtsScoreFromAnalysis(finalAnalysis),
      finalAiReviewerScore: computeAiReviewerScore(finalAnalysis),
      nextAction: passed
        ? 'Quality gate passed. Proceed to export generation.'
        : 'Quality gate not met. Regenerate analysis or refine resume inputs.',
      supportingArchitecture: buildSupportingArchitectureStatus(workflowGate, templateResume),
      sources: {
        primaryResumeConnected: true,
        templateResumeConnected: Boolean(templateResume.fileName),
        companyUrlConnected: Boolean(companyUrl),
        linkedinConnected: Boolean(linkedinInput),
      },
    },
  };

  await prisma.jobAnalysis.upsert({
    where: { jobId: job.id },
    create: {
      jobId: job.id,
      analysisData: finalAnalysis,
    },
    update: {
      analysisData: finalAnalysis,
    },
  });

  return finalAnalysis;
};
