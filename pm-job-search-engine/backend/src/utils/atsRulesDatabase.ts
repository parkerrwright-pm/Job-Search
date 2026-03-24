/**
 * ATS Rules Database — Structured optimization rules per ATS platform.
 * Referenced in ResumeCreator.Drawio as "ATS Rules Database" supporting architecture.
 *
 * Each entry contains keyword weight rules, formatting requirements,
 * and tactical optimization strategies specific to that system.
 */

export interface ATSRule {
  system: string;
  formatRules: string[];
  keywordWeights: { category: string; weight: 'critical' | 'high' | 'medium'; notes: string }[];
  optimizationStrategies: string[];
  knownPitfalls: string[];
}

export const ATS_RULES_DATABASE: Record<string, ATSRule> = {
  Greenhouse: {
    system: 'Greenhouse',
    formatRules: [
      'Use standard section headers: Summary, Experience, Education, Skills.',
      'Avoid tables, columns, and text boxes — Greenhouse parses linearly.',
      'Use .docx or .pdf; .docx is preferred for best parsing fidelity.',
      'Keep bullet points with standard bullet characters (•, -, *).',
      'Do not embed images or logos; they are ignored and may break parsing.',
    ],
    keywordWeights: [
      { category: 'Job title exact match', weight: 'critical', notes: 'Greenhouse scorecard auto-matches job title keywords.' },
      { category: 'Required skills (hard skills)', weight: 'critical', notes: 'Custom scorecards weight these highest.' },
      { category: 'Industry/domain terms', weight: 'high', notes: 'Recruiters filter by domain expertise keywords.' },
      { category: 'Certifications and tools', weight: 'high', notes: 'Parsed into structured fields for quick screening.' },
      { category: 'Soft skills and competencies', weight: 'medium', notes: 'Used in scorecard but weighted less than technical.' },
    ],
    optimizationStrategies: [
      'Mirror the exact job title in your headline or summary — Greenhouse uses title matching in candidate search.',
      'List skills in a dedicated "Skills" section — Greenhouse extracts this as structured data.',
      'Include each required qualification verbatim at least once in experience bullets.',
      'Use chronological format with clear date ranges (Month YYYY – Month YYYY).',
      'Keep resume to 1-2 pages; Greenhouse displays parsed content in a compact profile view.',
    ],
    knownPitfalls: [
      'Headers in unusual formats (e.g., "Professional Journey" instead of "Experience") may not parse correctly.',
      'Multi-column layouts cause content to appear scrambled after parsing.',
      'PDF formatting with non-standard fonts may lose characters during extraction.',
    ],
  },

  Workday: {
    system: 'Workday',
    formatRules: [
      'Use a single-column, linear layout — Workday parses top-to-bottom.',
      'Standard section headers required: Summary, Work Experience, Education, Skills.',
      'Date format must be recognizable: "Month YYYY – Month YYYY" or "MM/YYYY – MM/YYYY".',
      'Avoid headers/footers; Workday may not parse them.',
      'Keep formatting simple — bold and italics are fine, but avoid complex styling.',
    ],
    keywordWeights: [
      { category: 'Job requisition keywords', weight: 'critical', notes: 'Workday auto-screens based on req keywords.' },
      { category: 'Years of experience', weight: 'critical', notes: 'Workday extracts and validates experience duration.' },
      { category: 'Education level', weight: 'high', notes: 'Degree requirements are parsed and auto-filtered.' },
      { category: 'Location/willingness to relocate', weight: 'high', notes: 'Workday uses location for compliance filtering.' },
      { category: 'Technical tools and platforms', weight: 'medium', notes: 'Matched against job skills configuration.' },
    ],
    optimizationStrategies: [
      'State years of experience explicitly: "8+ years of product management experience."',
      'Include education with degree type, institution, and graduation year — Workday auto-extracts this.',
      'Use the exact job title from the posting in your resume headline.',
      'Spell out acronyms on first use — Workday keyword matching is literal.',
      'List each required skill from the posting explicitly in your skills section.',
    ],
    knownPitfalls: [
      'Workday often requires manual form entry; ensure resume content maps cleanly to form fields.',
      'Unusual date formats (e.g., "2020-2023") may not parse into start/end dates correctly.',
      'Embedded tables cause parsing failures — use plain bullet lists instead.',
    ],
  },

  Lever: {
    system: 'Lever',
    formatRules: [
      'Lever handles most formats well (.docx, .pdf, .txt).',
      'Use clear section breaks — Lever relies on section headers for field mapping.',
      'Simple, clean formatting is best; Lever previews the original document alongside parsed data.',
      'Chronological or reverse-chronological format preferred.',
      'Include contact info at the top — Lever extracts name, email, phone, LinkedIn.',
    ],
    keywordWeights: [
      { category: 'Role-specific technical skills', weight: 'critical', notes: 'Lever tags are used for keyword search.' },
      { category: 'Company/industry alignment', weight: 'high', notes: 'Recruiters use Lever search to filter by industry.' },
      { category: 'Methodology and frameworks', weight: 'high', notes: 'Agile, Scrum, OKRs, etc. used as filter tags.' },
      { category: 'Leadership indicators', weight: 'medium', notes: 'Team size, cross-functional work noted in feedback.' },
      { category: 'Quantified achievements', weight: 'medium', notes: 'Reviewers score candidates on impact evidence.' },
    ],
    optimizationStrategies: [
      'Lever shows both the raw resume and parsed profile — ensure both read well.',
      'Use keywords from the job posting naturally throughout experience bullets.',
      'Include a LinkedIn URL — Lever auto-pulls and displays LinkedIn data.',
      'Quantify achievements with specific metrics (%, $, users, timeline).',
      'Match the seniority language of the role (e.g., "led", "managed", "directed" for senior roles).',
    ],
    knownPitfalls: [
      'Lever feedback forms are free-text — weak keyword density means reviewers may miss qualifications.',
      'Non-standard section names may not map to Lever profile fields.',
      'Very long resumes (3+ pages) can reduce reviewer engagement.',
    ],
  },

  iCIMS: {
    system: 'iCIMS',
    formatRules: [
      '.docx format is strongly preferred — iCIMS has better .docx parsing than PDF.',
      'Use standard sections: Objective/Summary, Experience, Education, Skills.',
      'Include exact dates with month and year for each position.',
      'Avoid graphics, charts, and multi-column layouts.',
      'Standard bullet characters only; iCIMS may not parse special Unicode bullets.',
    ],
    keywordWeights: [
      { category: 'Required qualifications exact terms', weight: 'critical', notes: 'iCIMS knockout questions use exact term matching.' },
      { category: 'License and certifications', weight: 'critical', notes: 'iCIMS has dedicated cert fields that auto-screen.' },
      { category: 'Degree and education level', weight: 'high', notes: 'Auto-filtered against minimum education requirements.' },
      { category: 'Industry-specific terminology', weight: 'high', notes: 'Used in recruiter keyword searches.' },
      { category: 'Action verbs in experience', weight: 'medium', notes: 'AI screening scores activity-based language higher.' },
    ],
    optimizationStrategies: [
      'Answer all screening questions on the application — iCIMS auto-rejects incomplete submissions.',
      'Use the exact terminology from the job posting — iCIMS matching is often literal.',
      'Include license/certification details with issuing body and date — iCIMS extracts these.',
      'Put your strongest keywords in the first third of the resume — iCIMS preview shows the top portion.',
      'Keep formatting minimal and professional; iCIMS reformats aggressively.',
    ],
    knownPitfalls: [
      'iCIMS has aggressive auto-reject on knockout questions — missing a required field = instant rejection.',
      'Complex DOCX formatting (text boxes, SmartArt) causes parsing failures.',
      'PDF parsing in iCIMS is less reliable than DOCX; prefer .docx.',
    ],
  },

  Taleo: {
    system: 'Taleo',
    formatRules: [
      'Taleo parses .docx, .doc, .pdf, and .txt; .docx performs best.',
      'Use very simple formatting — Taleo has the most aggressive reformatting of any major ATS.',
      'Standard section headers are essential: Summary, Experience, Education, Skills.',
      'Avoid all tables, columns, text boxes, and embedded objects.',
      'Use 10-12pt standard fonts (Arial, Calibri, Times New Roman).',
    ],
    keywordWeights: [
      { category: 'Requisition match keywords', weight: 'critical', notes: 'Taleo uses flex fields and req match scoring.' },
      { category: 'Minimum qualifications terms', weight: 'critical', notes: 'Auto-disqualification if minimum quals terms are missing.' },
      { category: 'Job family/category alignment', weight: 'high', notes: 'Taleo categorizes candidates by job family.' },
      { category: 'Compliance and regulatory terms', weight: 'high', notes: 'Important for government, healthcare, and finance roles.' },
      { category: 'Years of experience mentions', weight: 'medium', notes: 'Taleo can parse and validate experience duration.' },
    ],
    optimizationStrategies: [
      'Taleo aggressively reformats — what you see is NOT what the recruiter sees. Optimize for text content, not visual layout.',
      'Repeat critical keywords 2-3 times naturally across different sections.',
      'State "X years of experience in [domain]" explicitly — Taleo req matching uses this.',
      'List education with exact degree title, institution name, and graduation year.',
      'Include a skills section with each JD required skill listed individually.',
    ],
    knownPitfalls: [
      'Taleo is one of the oldest ATS systems — it handles modern formatting poorly.',
      'Graphics, logos, and non-standard characters are stripped completely.',
      'Multi-page text boxes and columns will scramble content order.',
      'Some Taleo instances require copy-paste into web forms — ensure resume text is clean when pasted.',
    ],
  },

  Unknown: {
    system: 'Unknown',
    formatRules: [
      'Use .docx format for maximum compatibility across all ATS systems.',
      'Single-column layout with standard section headers.',
      'Standard fonts (Arial, Calibri, Times New Roman) at 10-12pt.',
      'Avoid tables, text boxes, columns, images, and special formatting.',
      'Use standard bullet characters (•, -, *).',
    ],
    keywordWeights: [
      { category: 'Job title and role terms', weight: 'critical', notes: 'Most ATS systems weight title matching heavily.' },
      { category: 'Required skills from posting', weight: 'critical', notes: 'Universal high-weight across all ATS platforms.' },
      { category: 'Industry and domain terms', weight: 'high', notes: 'Used for search and filtering.' },
      { category: 'Quantified achievements', weight: 'high', notes: 'Strong signal for both ATS scoring and human review.' },
      { category: 'Certifications and tools', weight: 'medium', notes: 'Varies by ATS but generally parsed as structured data.' },
    ],
    optimizationStrategies: [
      'Mirror exact terms from the job posting — most ATS systems use literal keyword matching.',
      'Include a dedicated Skills section listing each required skill from the posting.',
      'State years of experience explicitly: "X years of [domain] experience."',
      'Use standard section headers: Summary, Experience, Education, Skills.',
      'Keep resume to 1-2 pages with clear, scannable structure.',
    ],
    knownPitfalls: [
      'Without knowing the ATS, assume the most conservative formatting requirements.',
      'Any non-text content (images, charts, complex tables) is risky.',
      'Unusual section headers may not be recognized across ATS platforms.',
    ],
  },
};

/**
 * Detect ATS system from a job URL using known URL patterns.
 * Returns the ATS name (e.g. "Greenhouse") or "Unknown" if no match.
 * This is a fast, deterministic check — no AI call required.
 */
export const detectAtsFromUrl = (url: string): string => {
  if (!url) return 'Unknown';
  const lower = url.toLowerCase();

  const patterns: [RegExp, string][] = [
    [/greenhouse\.io|boards\.greenhouse\.io/,        'Greenhouse'],
    [/lever\.co|hire\.lever\.co|jobs\.lever\.co/,     'Lever'],
    [/myworkday\w*\.com|wd\d+\.myworkday/,           'Workday'],
    [/icims\.com|jobs-.*\.icims\.com/,                'iCIMS'],
    [/taleo\.net|oracle\.com\/.*taleo/,               'Taleo'],
    [/smartrecruiters\.com|jobs\.smartrecruiters\.com/,'SmartRecruiters'],
    [/jobvite\.com|jobs\.jobvite\.com/,               'Jobvite'],
    [/ashbyhq\.com|jobs\.ashbyhq\.com/,               'Ashby'],
    [/breezy\.hr|app\.breezy\.hr/,                    'BreezyHR'],
    [/jazz\.co|app\.jazz\.co|resumator\.com/,         'JazzHR'],
    [/bamboohr\.com|.*\.bamboohr\.com\/jobs/,         'BambooHR'],
    [/workable\.com|apply\.workable\.com/,            'Workable'],
    [/recruiterbox\.com/,                             'Recruiterbox'],
    [/successfactors\.com|performancemanager.*\.successfactors/,'SuccessFactors'],
  ];

  for (const [pattern, system] of patterns) {
    if (pattern.test(lower)) return system;
  }

  return 'Unknown';
};

/**
 * Per-ATS minimum ATS score thresholds.
 * Stricter ATS platforms (auto-screening, knockout questions) need higher scores.
 */
export const ATS_SCORE_THRESHOLDS: Record<string, number> = {
  Greenhouse:      80,   // Standard — scorecard-based, moderate strictness
  Lever:           75,   // More human-review oriented, less automated filtering
  Workday:         85,   // Strict auto-screening and requisition keyword matching
  iCIMS:           85,   // Knockout questions, exact term matching, aggressive auto-reject
  Taleo:           85,   // Oldest ATS, aggressive reformatting, literal keyword matching
  SmartRecruiters: 80,   // Standard screening
  Jobvite:         80,   // Standard screening
  Ashby:           78,   // Modern ATS, less aggressive filtering
  BreezyHR:        78,   // Modern ATS
  JazzHR:          78,   // Small-business ATS, less aggressive
  BambooHR:        78,   // HR-focused, lighter screening
  Workable:        78,   // Modern ATS, moderate filtering
  Recruiterbox:    78,   // Standard
  SuccessFactors:  85,   // Enterprise SAP module, strict
  Unknown:         80,   // Conservative default
};

/**
 * Get the minimum ATS score threshold for a detected ATS system.
 */
export const getAtsScoreThreshold = (detectedSystem: string): number => {
  return ATS_SCORE_THRESHOLDS[detectedSystem] ?? ATS_SCORE_THRESHOLDS.Unknown;
};

/**
 * Per-ATS prompt addenda injected into the RESUME_EXPORT_SYNTHESIS prompt
 * to give the AI ATS-specific optimization instructions.
 */
export const ATS_PROMPT_ADDENDA: Record<string, string> = {
  Greenhouse: `ATS-SPECIFIC OPTIMIZATION (Greenhouse):
- Greenhouse uses scorecard-based evaluation — mirror exact job title in headline/summary.
- Greenhouse extracts Skills as structured data, so a clean dedicated Skills section is critical.
- Use standard section headers (Summary, Experience, Education, Skills) — Greenhouse maps these to profile fields.
- .docx format gets best parsing fidelity. Avoid tables and multi-column layouts.
- Include each required qualification verbatim at least once in experience bullets.`,

  Lever: `ATS-SPECIFIC OPTIMIZATION (Lever):
- Lever shows both the raw resume and parsed profile — ensure both read well.
- Lever is more human-review oriented; focus on readability and compelling narrative alongside keywords.
- Include LinkedIn URL — Lever auto-pulls and displays LinkedIn data.
- Keyword density matters less than Workday/iCIMS, but ensure all required skills appear naturally.
- Quantified achievements are heavily weighted by Lever reviewers scoring candidates on impact.`,

  Workday: `ATS-SPECIFIC OPTIMIZATION (Workday):
- Workday has strict auto-screening — keyword matching is LITERAL. Use exact JD terminology.
- State years of experience explicitly: "8+ years of product management experience" — Workday validates this.
- Spell out acronyms on first use — Workday keyword matching doesn't infer abbreviations.
- Education with degree type, institution, and grad year is critical — Workday auto-extracts and validates.
- Use single-column layout with standard section headers — Workday parses top-to-bottom.
- MINIMUM SCORE FOR THIS ATS: 85/100. Workday's automated filters are stricter than average.`,

  iCIMS: `ATS-SPECIFIC OPTIMIZATION (iCIMS):
- iCIMS uses knockout questions and exact term matching — missing a required term can mean auto-rejection.
- .docx format is STRONGLY preferred over PDF for iCIMS — much better parsing accuracy.
- Put strongest keywords in the first third of the resume — iCIMS preview shows the top portion first.
- Include license/certification details with issuing body and date — iCIMS extracts these as structured fields.
- Use the EXACT terminology from the job posting — iCIMS matching is often literal, not semantic.
- MINIMUM SCORE FOR THIS ATS: 85/100. iCIMS auto-reject on missing required terms is aggressive.`,

  Taleo: `ATS-SPECIFIC OPTIMIZATION (Taleo):
- Taleo is the oldest major ATS — use the SIMPLEST formatting possible (no tables, columns, text boxes).
- Taleo aggressively reformats; what you submit is NOT what the recruiter sees. Optimize TEXT CONTENT over layout.
- Repeat critical keywords 2-3 times naturally across different sections for density.
- Use standard 10-12pt fonts (Arial, Calibri, Times New Roman) — non-standard fonts lose characters.
- State "X years of experience in [domain]" explicitly — Taleo req matching uses this phrase pattern.
- MINIMUM SCORE FOR THIS ATS: 85/100. Taleo's keyword matching requires high density.`,

  Unknown: `ATS-SPECIFIC OPTIMIZATION (Unknown ATS):
- Use the most universally compatible formatting: single-column .docx, standard fonts, no tables/images.
- Mirror exact terms from the job posting — most ATS systems use literal keyword matching.
- Include a dedicated Skills section and state years of experience explicitly.
- Use standard section headers: Summary, Experience, Education, Skills.`,
};

/**
 * Get the ATS-specific prompt addendum for injection into synthesis prompts.
 */
export const getAtsPromptAddendum = (detectedSystem: string): string => {
  return ATS_PROMPT_ADDENDA[detectedSystem] ?? ATS_PROMPT_ADDENDA.Unknown;
};

/**
 * Look up ATS-specific rules based on the detected system name.
 * Falls back to the "Unknown" rule set if the system isn't in the database.
 */
export const getATSRules = (detectedSystem: string): ATSRule => {
  const normalized = detectedSystem.trim();
  return ATS_RULES_DATABASE[normalized] || ATS_RULES_DATABASE.Unknown;
};

/**
 * Format ATS rules as a plain-text context string suitable for injection
 * into AI prompts or refinement context.
 */
export const formatATSRulesForPrompt = (rules: ATSRule): string => {
  const lines: string[] = [
    `=== ATS OPTIMIZATION RULES: ${rules.system} ===`,
    '',
    'FORMAT RULES:',
    ...rules.formatRules.map((r) => `  • ${r}`),
    '',
    'KEYWORD WEIGHTS:',
    ...rules.keywordWeights.map(
      (k) => `  • [${k.weight.toUpperCase()}] ${k.category}: ${k.notes}`,
    ),
    '',
    'OPTIMIZATION STRATEGIES:',
    ...rules.optimizationStrategies.map((s) => `  • ${s}`),
    '',
    'KNOWN PITFALLS:',
    ...rules.knownPitfalls.map((p) => `  ⚠ ${p}`),
  ];
  return lines.join('\n');
};
