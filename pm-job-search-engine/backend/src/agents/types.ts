// ─── Shared Types for Sub-Agent Architecture ─────────────────────────────────

export type ParsedJobDescription = {
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  seniorityLevel: string;
  experienceYears: string;
  domainKeywords: string[];
  educationRequirements: string[];
};

export type ExperienceEntry = {
  title: string;
  company: string;
  location?: string;
  dates: string;
  scope?: string;
  bullets: string[];
};

export type EducationEntry = {
  degree: string;
  institution: string;
  year?: string;
};

export type TailoredResumeOutput = {
  headline: string;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: string[];
  experienceBullets: string[]; // legacy flat list, kept for backward compat
  keywordsAdded: string[];
  atsRecommendations: string[];
  generatedAt: string;
  targetRole: string;
  targetCompany: string;
  generationVersion: number;
  generationSource: string;
  generationProvider?: 'openai' | 'anthropic' | 'unknown';
  generationModel?: string | null;
  fallbackMode?: string;
};

export const RESUME_OUTPUT_GENERATION_VERSION = 4;

export type WorkflowGateConfig = {
  minAtsScore: number;
  minAiReviewerScore: number;
  maxIterations: number;
  truthfulnessGuardrail: boolean;
};

export type WorkflowScoreEntry = {
  iteration: number;
  atsScore: number;
  aiReviewerScore: number;
  passed: boolean;
  durationMs: number;
  generatedAt: string;
};

export type QualityGateSnapshot = {
  atsScore: number;
  aiReviewerScore: number;
  minAtsScore: number;
  minAiReviewerScore: number;
  passed: boolean;
  iterationsRun: number;
  generatedAt: string | null;
};

export type SupportingArchitectureStatus = {
  promptTemplateLibrary: { connected: boolean; source: string };
  resumeTemplateStore: { connected: boolean; templateFound: boolean; templateFileName?: string };
  atsRulesDatabase: { connected: boolean; version: string; source: string; systems: string[] };
  qualityGateConfig: { connected: boolean; minAtsScore: number; minAiReviewerScore: number; maxIterations: number };
  sessionStateStore: { connected: boolean; mechanism: string };
  exportEngine: { connected: boolean; word: boolean; pdf: boolean };
  auditObservability: { connected: boolean; analysisRunLogging: boolean; scoreHistory: boolean };
  errorHandling: { connected: boolean; gracefulFallback: boolean };
  securityLayer: { connected: boolean; authRequired: boolean };
};

export const DEFAULT_WORKFLOW_GATE: WorkflowGateConfig = {
  minAtsScore: 80,
  minAiReviewerScore: 90,
  maxIterations: 3,
  truthfulnessGuardrail: true,
};

export type ParsedResumeStructure = {
  name: string;
  contactLine: string;
  contactLine2: string;
  workEntries: Array<{ title: string; company: string; dates: string; bullets: string[] }>;
  educationLines: string[];
};

export type ParsedResumeEnhanced = {
  name: string;
  contactLines: string[];
  summary: string;
  skills: string[];
  workEntries: Array<{
    title: string;
    company: string;
    location?: string;
    dates: string;
    bullets: string[];
  }>;
  educationLines: string[];
  certifications: string[];
};
