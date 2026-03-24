// ─── Quality Gate Evaluator Agent (Sub-Agent 5) ───────────────────────────────
// Responsible for scoring, gate checks, refinement context, and post-synthesis scoring.

import {
  WorkflowGateConfig,
  QualityGateSnapshot,
  TailoredResumeOutput,
  DEFAULT_WORKFLOW_GATE,
} from './types';
import { clampNumber, normalizeScore, normalizeStringList } from './shared';

export const parseWorkflowGateConfig = (raw: any): WorkflowGateConfig => {
  const source = raw?.qualityGate && typeof raw.qualityGate === 'object' ? raw.qualityGate : raw;
  if (!source || typeof source !== 'object') {
    return DEFAULT_WORKFLOW_GATE;
  }

  return {
    minAtsScore: clampNumber(Number(source.minAtsScore ?? DEFAULT_WORKFLOW_GATE.minAtsScore), 50, 100),
    minAiReviewerScore: clampNumber(
      Number(source.minAiReviewerScore ?? DEFAULT_WORKFLOW_GATE.minAiReviewerScore),
      50,
      100,
    ),
    maxIterations: clampNumber(Number(source.maxIterations ?? DEFAULT_WORKFLOW_GATE.maxIterations), 1, 6),
    truthfulnessGuardrail:
      source.truthfulnessGuardrail !== undefined
        ? Boolean(source.truthfulnessGuardrail)
        : DEFAULT_WORKFLOW_GATE.truthfulnessGuardrail,
  };
};

export const extractAtsScoreFromAnalysis = (analysis: any): number => {
  const ats = analysis?.sections?.atsVmockScore;
  return normalizeScore(
    ats?.overallScore ?? ats?.currentScore ?? ats?.atsScore ?? ats?.score ?? 0,
  );
};

export const computeAiReviewerScore = (analysis: any): number => {
  const sections = analysis?.sections || {};
  const checks = [
    sections.summaryOptions,
    sections.skillsSection,
    sections.bulletRewrites,
    sections.missingKeywords,
    sections.interviewQuestions,
    sections.networkingMessages,
    sections.jobMatchSummary,
  ];

  let filled = 0;
  checks.forEach((value) => {
    if (typeof value === 'string' && value.trim().length >= 40) {
      filled += 1;
      return;
    }
    if (Array.isArray(value) && value.length > 0) {
      filled += 1;
      return;
    }
    if (value && typeof value === 'object' && Object.keys(value).length > 0) {
      filled += 1;
    }
  });

  return Math.round((filled / checks.length) * 100);
};

export const resolveQualityGateSnapshot = (analysisData: any): QualityGateSnapshot => {
  const workflow = analysisData?.workflow || {};
  const gate = parseWorkflowGateConfig(workflow?.qualityGate || null);
  const atsScore = normalizeScore(workflow?.finalAtsScore ?? extractAtsScoreFromAnalysis(analysisData));
  const aiReviewerScore = normalizeScore(workflow?.finalAiReviewerScore ?? computeAiReviewerScore(analysisData));

  const scoreHistory = Array.isArray(workflow?.scoreHistory) ? workflow.scoreHistory : [];
  const latestEntry = scoreHistory.length ? scoreHistory[scoreHistory.length - 1] : null;
  const passed =
    typeof workflow?.passed === 'boolean'
      ? workflow.passed
      : atsScore >= gate.minAtsScore && aiReviewerScore >= gate.minAiReviewerScore;

  return {
    atsScore,
    aiReviewerScore,
    minAtsScore: gate.minAtsScore,
    minAiReviewerScore: gate.minAiReviewerScore,
    passed,
    iterationsRun: Number(workflow?.iterationsRun || scoreHistory.length || 1),
    generatedAt: latestEntry?.generatedAt || null,
  };
};

export const buildQualityGateFailureMessage = (
  analysisData: any,
  qualityGate: QualityGateSnapshot,
): string => {
  const ats = analysisData?.sections?.atsVmockScore || {};

  const keywordDensity = normalizeScore(ats?.keywordDensity);
  const actionVerbsScore = normalizeScore(ats?.actionVerbsScore);
  const metricsScore = normalizeScore(ats?.metricsScore);
  const skillsAlignmentScore = normalizeScore(ats?.skillsAlignmentScore);

  const gaps = Array.isArray(ats?.gaps)
    ? ats.gaps.map((item: any) => String(item).trim()).filter(Boolean).slice(0, 3)
    : [];
  const recommendations = Array.isArray(ats?.recommendations)
    ? ats.recommendations.map((item: any) => String(item).trim()).filter(Boolean).slice(0, 3)
    : [];

  const subscoreSummary =
    ` ATS subscores - keyword density ${keywordDensity}/100, action verbs ${actionVerbsScore}/100, ` +
    `metrics ${metricsScore}/100, skills alignment ${skillsAlignmentScore}/100.`;

  const gapsSummary = gaps.length ? ` Top gaps: ${gaps.join(' | ')}.` : '';
  const recommendationsSummary = recommendations.length
    ? ` Recommended fixes: ${recommendations.join(' | ')}.`
    : '';

  return (
    `Quality gate not met for export. ATS score ${qualityGate.atsScore}/100 (minimum ${qualityGate.minAtsScore}) ` +
    `and AI score ${qualityGate.aiReviewerScore}/100 (minimum ${qualityGate.minAiReviewerScore}).` +
    subscoreSummary +
    gapsSummary +
    recommendationsSummary +
    ' Refine inputs and regenerate analysis before exporting.'
  );
};

export const buildRefinementContext = (analysis: any, iteration: number, baselineAtsScore?: number): string => {
  const ats = analysis?.sections?.atsVmockScore;
  const currentScore = extractAtsScoreFromAnalysis(analysis);
  const gaps = Array.isArray(ats?.gaps) ? ats.gaps.slice(0, 5) : [];
  const recommendations = Array.isArray(ats?.recommendations)
    ? ats.recommendations.slice(0, 5)
    : [];

  const missingKeywords =
    typeof analysis?.sections?.missingKeywords === 'string'
      ? analysis.sections.missingKeywords.slice(0, 800)
      : '';

  const lines = [
    `Iteration ${iteration} refinement focus:`,
    `Current ATS score: ${currentScore}/100.`,
  ];

  if (baselineAtsScore !== undefined) {
    lines.push(
      `CRITICAL SCORE FLOOR: The original primary resume scored ${baselineAtsScore}/100. ` +
      `Your output MUST score HIGHER than ${baselineAtsScore}. ` +
      `Do NOT remove metrics, keywords, or quantified achievements from the original resume. ` +
      `Only ADD improvements — never subtract existing strengths.`,
    );
  }

  if (gaps.length) lines.push(`Top ATS gaps: ${gaps.join('; ')}`);
  if (recommendations.length) lines.push(`Top recommendations: ${recommendations.join('; ')}`);
  if (missingKeywords) lines.push(`Missing keywords guidance: ${missingKeywords}`);

  return lines.filter(Boolean).join('\n');
};

/**
 * After AI synthesis, re-score ATS based on keyword coverage in the tailored output.
 */
export const computePostSynthesisQualityGate = (
  analysisData: any,
  output: TailoredResumeOutput,
  preGate: QualityGateSnapshot,
): QualityGateSnapshot => {
  const outputParts = [
    output.headline,
    output.summary,
    ...output.skills,
    ...output.experienceBullets,
    ...output.experience.flatMap(e => [e.title, e.company, ...(e.scope ? [e.scope] : []), ...e.bullets]),
    ...output.education.map(e => `${e.degree} ${e.institution}`),
    ...output.certifications,
    ...output.keywordsAdded,
  ];
  const fullText = outputParts.join(' ').toLowerCase();

  const parseKeywordsFromMissingKeywords = (mk?: string): string[] => {
    if (!mk || typeof mk !== 'string') return [];
    return mk
      .split(/\n|,|;/)
      .map((item) => item.replace(/^[-*•]\s*/, '').trim())
      .filter((item) => item.length >= 2)
      .slice(0, 12);
  };

  const missingKeywords = parseKeywordsFromMissingKeywords(
    analysisData?.sections?.missingKeywords,
  );

  if (missingKeywords.length === 0) return preGate;

  const matched = missingKeywords.filter(kw => fullText.includes(kw.toLowerCase()));
  const coverageRatio = matched.length / missingKeywords.length;

  const maxBoost = 100 - preGate.atsScore;
  const boostedAts = Math.min(100, Math.round(preGate.atsScore + maxBoost * coverageRatio * 0.85));
  const aiBoost = Math.min(100, Math.round(preGate.aiReviewerScore + (100 - preGate.aiReviewerScore) * coverageRatio * 0.5));

  const passed = boostedAts >= preGate.minAtsScore && aiBoost >= preGate.minAiReviewerScore;

  return {
    ...preGate,
    atsScore: boostedAts,
    aiReviewerScore: aiBoost,
    passed,
  };
};
