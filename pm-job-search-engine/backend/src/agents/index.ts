// ─── Agents Barrel Export ──────────────────────────────────────────────────────
// Central re-export so routes can import from a single location.

// Types
export type {
  ParsedJobDescription,
  ExperienceEntry,
  EducationEntry,
  TailoredResumeOutput,
  WorkflowGateConfig,
  WorkflowScoreEntry,
  QualityGateSnapshot,
  SupportingArchitectureStatus,
  ParsedResumeStructure,
  ParsedResumeEnhanced,
} from './types';
export { RESUME_OUTPUT_GENERATION_VERSION, DEFAULT_WORKFLOW_GATE } from './types';

// Shared utilities
export {
  clampNumber,
  normalizeScore,
  normalizeStringList,
  normalizeExperienceEntries,
  normalizeEducationEntries,
  isQuotaExceededError,
  extractCandidateName,
  buildExportFilename,
  extractLocationFromDescription,
  extractSalaryFromDescription,
  extractPriorityFromDescription,
  isFallbackAnalysisData,
  analysisNeedsRefresh,
  buildFallbackAnalysisMessage,
  formatBullets,
  chunkSkills,
} from './shared';

// Sub-Agent 1: Input Resolution
export {
  extractSelectedPrimaryResumeId,
  getPrimaryResumeText,
  getTemplateResume,
  getTemplateResumeText,
  getLatestJobAnalysisData,
  getDocxTemplateBuffer,
  computeAlignmentRating,
} from './inputResolutionAgent';

// Sub-Agent 2: Parsing & Extraction
export {
  parseJobDescriptionStructure,
  parseResumeStructureEnhanced,
  buildParsedContextBlock,
  parseResumeStructure,
  parsePrimaryResumeText,
} from './parsingAgent';

// Sub-Agent 4: AI Analysis Coordinator
export { runJobWorkflowAnalysis } from './analysisCoordinatorAgent';

// Sub-Agent 5: Quality Gate Evaluator
export {
  parseWorkflowGateConfig,
  extractAtsScoreFromAnalysis,
  computeAiReviewerScore,
  resolveQualityGateSnapshot,
  buildQualityGateFailureMessage,
  buildRefinementContext,
  computePostSynthesisQualityGate,
} from './qualityGateAgent';

// Sub-Agent 6: Export Synthesis
export {
  buildOutputFromJobAnalysis,
  analysisHasAiGeneratedContent,
  hasUsefulAnalysisDerivedContent,
  buildQuotaFallbackOutput,
  createTailoredResumeOutput,
  createPreviewResumeOutput,
  getOrCreateTailoredResumeOutput,
  getPreviewOutput,
} from './exportSynthesisAgent';

// Sub-Agent 7: File Generation
export {
  renderWithDocxTemplate,
  buildCompleteResumeDocx,
  buildWordBuffer,
  buildPdfBuffer,
} from './fileGenerationAgent';
