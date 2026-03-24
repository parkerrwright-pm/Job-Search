// ─── Parsing & Extraction Agent (Sub-Agent 2) ─────────────────────────────────
// Responsible for parsing resume text and job descriptions into structured data.

import {
  ParsedJobDescription,
  ParsedResumeEnhanced,
  ParsedResumeStructure,
} from './types';

/**
 * Parse a job description into structured buckets:
 * required/preferred skills, responsibilities, education, seniority, experience years.
 */
export const parseJobDescriptionStructure = (text: string): ParsedJobDescription => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];
  const responsibilities: string[] = [];
  const educationRequirements: string[] = [];
  let seniorityLevel = 'Mid-Level';
  let experienceYears = '';

  let section: 'required' | 'preferred' | 'responsibilities' | 'education' | 'none' = 'none';

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (/\b(required|must have|minimum qualifications|basic qualifications)\b/i.test(line) && line.length < 80) {
      section = 'required';
      continue;
    }
    if (/\b(preferred|nice to have|desired|bonus|additional|plus)\b/i.test(line) && line.length < 80) {
      section = 'preferred';
      continue;
    }
    if (/\b(responsibilities|what you.ll do|role overview|duties|key responsibilities)\b/i.test(line) && line.length < 80) {
      section = 'responsibilities';
      continue;
    }
    if (/\b(education|degree|academic)\b/i.test(line) && line.length < 80) {
      section = 'education';
      continue;
    }

    const bullet = line.replace(/^[•\-\*●▪\d.)\]]+\s*/, '').trim();
    if (!bullet || bullet.length < 5) continue;

    switch (section) {
      case 'required':
        requiredSkills.push(bullet);
        break;
      case 'preferred':
        preferredSkills.push(bullet);
        break;
      case 'responsibilities':
        responsibilities.push(bullet);
        break;
      case 'education':
        educationRequirements.push(bullet);
        break;
      default:
        break;
    }
  }

  // Seniority detection
  const fullText = text.toLowerCase();
  if (/\b(vp|vice president|head of|director|c-suite|chief)\b/.test(fullText)) {
    seniorityLevel = 'Executive';
  } else if (/\bsenior\b/.test(fullText) || /\b(sr\.|staff|principal|lead)\b/.test(fullText)) {
    seniorityLevel = 'Senior';
  } else if (/\b(junior|entry.level|associate|intern)\b/.test(fullText)) {
    seniorityLevel = 'Junior';
  }

  // Years of experience
  const yearsMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp\.?)/i);
  if (yearsMatch) {
    experienceYears = `${yearsMatch[1]}+ years`;
  }

  // Domain keyword frequency
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'our', 'you', 'your', 'this', 'that', 'will',
    'are', 'from', 'have', 'has', 'been', 'was', 'were', 'can', 'may', 'not',
    'but', 'they', 'their', 'about', 'what', 'which', 'when', 'who', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'only', 'than', 'too', 'very', 'also', 'just', 'should', 'would',
    'could', 'into', 'over', 'after', 'before', 'between', 'under', 'above',
    'work', 'team', 'role', 'ability', 'experience', 'including', 'across',
    'strong', 'working', 'ensure', 'using', 'within',
  ]);
  const wordFreq: Record<string, number> = {};
  fullText
    .split(/[^a-z0-9+#.-]+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    });

  const domainKeywords = Object.entries(wordFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 20);

  return {
    requiredSkills: requiredSkills.slice(0, 20),
    preferredSkills: preferredSkills.slice(0, 15),
    responsibilities: responsibilities.slice(0, 15),
    seniorityLevel,
    experienceYears,
    domainKeywords,
    educationRequirements: educationRequirements.slice(0, 5),
  };
};

/**
 * Enhanced resume parser: extracts structured sections (summary, skills, experience,
 * education, certifications) with contact line expansion.
 */
export const parseResumeStructureEnhanced = (text: string): ParsedResumeEnhanced => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const name = lines.find(
    (l) =>
      l.length > 2 && l.length < 70 &&
      !/@/.test(l) && !/(http|www\.|linkedin\.com)/i.test(l) && !/^\d/.test(l),
  ) || '';

  const usStatesRe = /,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\s*$/i;
  const cityStateAbbrRe = /^[A-Z][a-zA-Z .'-]+,\s*[A-Z]{2}(\s+\d{5})?$/;
  const dateRangePatternEnh = /\b(\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\s*[-–]\s*(\d{4}|present|current)/i;
  const isLocationOnlyEnh = (l: string) =>
    (cityStateAbbrRe.test(l) || usStatesRe.test(l)) &&
    !dateRangePatternEnh.test(l) &&
    l.length < 40;

  // Expand pipe-delimited contact lines into individual segments
  const isContactSegment = (s: string) =>
    /@[\w.-]+\.\w+/.test(s) ||
    /\(?\d{3}\)?[-.\s\u2010-\u2015]\d{3}[-.\s\u2010-\u2015]\d{4}/.test(s) ||
    /linkedin\.com/i.test(s) ||
    isLocationOnlyEnh(s);

  const expandedContactSegments: string[] = [];
  for (const l of lines) {
    if (l.includes('|') && isContactSegment(l)) {
      const parts = l.split('|').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.some((p) => /@/.test(p) || /linkedin/i.test(p))) {
        expandedContactSegments.push(...parts.filter((p) => isContactSegment(p)));
        continue;
      }
    }
    if (isContactSegment(l)) expandedContactSegments.push(l);
  }
  const contactLines = expandedContactSegments.slice(0, 6);

  // Split into two rows: row1 = location + phone, row2 = email + linkedin
  const locationAndPhone = contactLines.filter(
    (l) => isLocationOnlyEnh(l) || (/\(?\d{3}\)?[-.\s\u2010-\u2015]\d{3}[-.\s\u2010-\u2015]\d{4}/.test(l) && !/@/.test(l) && !/linkedin/i.test(l)),
  );
  const emailAndLinks = contactLines.filter(
    (l) => /@[\w.-]+\.\w+/.test(l) || /linkedin\.com/i.test(l),
  );

  // Section detection
  const sectionHeaders: Record<string, RegExp> = {
    summary: /^(summary|profile|professional summary|objective|about)/i,
    skills: /^(skills|core skills|technical skills|key skills|core competencies|competencies)/i,
    experience: /^(experience|work history|professional experience|employment|career)/i,
    education: /^(education|academic)/i,
    certifications: /^(certifi|licenses?|credentials|accreditations?)/i,
  };

  type Section = 'summary' | 'skills' | 'experience' | 'education' | 'certifications' | 'other';
  let currentSection: Section = 'other';

  const summaryLines: string[] = [];
  const skillLines: string[] = [];
  const certLines: string[] = [];
  const educationLines: string[] = [];
  const workEntries: { title: string; company: string; dates: string; bullets: string[] }[] = [];
  let current: (typeof workEntries)[0] | null = null;

  const dateRangeRe = /\b(\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\s*[-–]\s*(\d{4}|present|current)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check section headers
    let headerMatch = false;
    for (const [section, pattern] of Object.entries(sectionHeaders)) {
      if (pattern.test(line) && line.length < 50) {
        if (current && currentSection === 'experience') { workEntries.push(current); current = null; }
        currentSection = section as Section;
        headerMatch = true;
        break;
      }
    }
    if (headerMatch) continue;

    // Route line to appropriate bucket
    switch (currentSection) {
      case 'summary':
        if (line.length > 10) summaryLines.push(line);
        break;
      case 'skills': {
        const delimited = line.split(/[,|•·]/).map((s) => s.trim()).filter((s) => s.length > 1);
        if (delimited.length > 1) {
          skillLines.push(...delimited);
        } else if (line.length > 2) {
          skillLines.push(line.replace(/^[•\-\*●▪]\s*/, ''));
        }
        break;
      }
      case 'education':
        educationLines.push(line);
        break;
      case 'certifications':
        if (line.length > 3) certLines.push(line.replace(/^[•\-\*●▪]\s*/, ''));
        break;
      case 'experience': {
        if (dateRangeRe.test(line)) {
          if (current) workEntries.push(current);
          const prevLine = i > 0 ? lines[i - 1] : '';
          const prev2Line = i > 1 ? lines[i - 2] : '';
          current = {
            title: prevLine && !dateRangeRe.test(prevLine) ? prevLine : '',
            company: prev2Line && !dateRangeRe.test(prev2Line) && prev2Line !== name ? prev2Line : '',
            dates: (line.match(dateRangeRe) || [''])[0],
            bullets: [],
          };
        } else if (current && /^[•\-\*●▪]/.test(line)) {
          current.bullets.push(line.replace(/^[•\-\*●▪]\s*/, ''));
        }
        break;
      }
      default: {
        if (dateRangeRe.test(line)) {
          if (current) workEntries.push(current);
          currentSection = 'experience';
          const prevLine = i > 0 ? lines[i - 1] : '';
          const prev2Line = i > 1 ? lines[i - 2] : '';
          current = {
            title: prevLine && !dateRangeRe.test(prevLine) ? prevLine : '',
            company: prev2Line && !dateRangeRe.test(prev2Line) && prev2Line !== name ? prev2Line : '',
            dates: (line.match(dateRangeRe) || [''])[0],
            bullets: [],
          };
        }
        break;
      }
    }
  }

  if (current) workEntries.push(current);

  return {
    name,
    contactLines,
    summary: summaryLines.join(' '),
    skills: skillLines.slice(0, 30),
    workEntries: workEntries.filter((e) => e.title || e.company || e.bullets.length > 0).slice(0, 8),
    educationLines: educationLines.slice(0, 8),
    certifications: certLines.slice(0, 10),
  };
};

/**
 * Format parsed Phase 2 data as a structured context block for AI prompts.
 */
export const buildParsedContextBlock = (
  parsedResume: ParsedResumeEnhanced,
  parsedJD: ParsedJobDescription,
): string => {
  const sections: string[] = [
    '=== PRE-PARSED RESUME STRUCTURE (Phase 2 Extraction) ===',
  ];

  if (parsedResume.summary) {
    sections.push(`Current Summary/Profile: ${parsedResume.summary}`);
  }
  if (parsedResume.skills.length > 0) {
    sections.push(`Current Resume Skills: ${parsedResume.skills.join(', ')}`);
  }
  if (parsedResume.certifications.length > 0) {
    sections.push(`Certifications: ${parsedResume.certifications.join(', ')}`);
  }
  sections.push(`Work Entries Found: ${parsedResume.workEntries.length}`);
  if (parsedResume.workEntries.length > 0) {
    const roleSummaries = parsedResume.workEntries.map(
      (e) => `${e.title}${e.company ? ` at ${e.company}` : ''} (${e.dates}) — ${e.bullets.length} bullets`,
    );
    sections.push(`Roles: ${roleSummaries.join('; ')}`);
  }

  sections.push('');
  sections.push('=== PRE-PARSED JOB DESCRIPTION STRUCTURE (Phase 2 Extraction) ===');
  sections.push(`Seniority Level: ${parsedJD.seniorityLevel}`);
  if (parsedJD.experienceYears) {
    sections.push(`Experience Required: ${parsedJD.experienceYears}`);
  }
  if (parsedJD.requiredSkills.length > 0) {
    sections.push(`Required Skills/Qualifications (${parsedJD.requiredSkills.length}):\n${parsedJD.requiredSkills.map((s) => `  • ${s}`).join('\n')}`);
  }
  if (parsedJD.preferredSkills.length > 0) {
    sections.push(`Preferred/Nice-to-Have (${parsedJD.preferredSkills.length}):\n${parsedJD.preferredSkills.map((s) => `  • ${s}`).join('\n')}`);
  }
  if (parsedJD.responsibilities.length > 0) {
    sections.push(`Key Responsibilities (${parsedJD.responsibilities.length}):\n${parsedJD.responsibilities.map((r) => `  • ${r}`).join('\n')}`);
  }
  if (parsedJD.educationRequirements.length > 0) {
    sections.push(`Education Requirements: ${parsedJD.educationRequirements.join(', ')}`);
  }
  if (parsedJD.domainKeywords.length > 0) {
    sections.push(`Domain Keywords (top frequency): ${parsedJD.domainKeywords.slice(0, 15).join(', ')}`);
  }

  return sections.join('\n');
};

/**
 * Simple resume structure parser (for DOCX/PDF formatting — uses date-range detection
 * rather than section headers).
 */
export const parseResumeStructure = (text: string): ParsedResumeStructure => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const name =
    lines.find(
      (l) =>
        l.length > 2 &&
        l.length < 70 &&
        !/@/.test(l) &&
        !/(http|www\.|linkedin\.com)/i.test(l) &&
        !/^\d/.test(l),
    ) || '';

  const usStatesRe2 = /,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\s*$/i;
  const cityStateAbbrRe2 = /^[A-Z][a-zA-Z .'-]+,\s*[A-Z]{2}(\s+\d{5})?$/;
  const dateRangePattern2 = /\b(\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\s*[-–]\s*(\d{4}|present|current)/i;
  const isLocationOnly2 = (l: string) =>
    (cityStateAbbrRe2.test(l) || usStatesRe2.test(l)) &&
    !dateRangePattern2.test(l) &&
    l.length < 40;

  const isContactSegment2 = (s: string) =>
    /@[\w.-]+\.\w+/.test(s) ||
    /\(?\d{3}\)?[-.\s\u2010-\u2015]\d{3}[-.\s\u2010-\u2015]\d{4}/.test(s) ||
    /linkedin\.com/i.test(s) ||
    isLocationOnly2(s);

  const expandedContactSegments2: string[] = [];
  for (const l of lines) {
    if (l.includes('|') && isContactSegment2(l)) {
      const parts = l.split('|').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.some((p) => /@/.test(p) || /linkedin/i.test(p))) {
        expandedContactSegments2.push(...parts.filter((p) => isContactSegment2(p)));
        continue;
      }
    }
    if (isContactSegment2(l)) expandedContactSegments2.push(l);
  }
  const contactLines = expandedContactSegments2.slice(0, 6);

  const locationAndPhone2 = contactLines.filter(
    (l) => isLocationOnly2(l) || (/\(?\d{3}\)?[-.\s\u2010-\u2015]\d{3}[-.\s\u2010-\u2015]\d{4}/.test(l) && !/@/.test(l) && !/linkedin/i.test(l)),
  );
  const emailAndLinks2 = contactLines.filter(
    (l) => /@[\w.-]+\.\w+/.test(l) || /linkedin\.com/i.test(l),
  );

  const dateRangeRe =
    /\b(\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\s*[-–]\s*(\d{4}|present|current)/i;

  const workEntries: Array<{ title: string; company: string; dates: string; bullets: string[] }> = [];
  const educationLines: string[] = [];

  let mode: 'work' | 'education' | 'other' = 'other';
  let current: (typeof workEntries)[0] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^(education|academic)/i.test(line) && line.length < 35) {
      if (current) { workEntries.push(current); current = null; }
      mode = 'education';
      continue;
    }
    if (/^(experience|work history|professional experience|employment|career)/i.test(line) && line.length < 50) {
      if (current) { workEntries.push(current); current = null; }
      mode = 'work';
      continue;
    }
    if (/^(skills|summary|profile|certifi|achieve|award)/i.test(line) && line.length < 35) {
      if (current) { workEntries.push(current); current = null; }
      mode = 'other';
      continue;
    }

    if (mode === 'education') {
      educationLines.push(line);
      continue;
    }

    if (dateRangeRe.test(line)) {
      if (current) workEntries.push(current);
      const prevLine = i > 0 ? lines[i - 1] : '';
      const prev2Line = i > 1 ? lines[i - 2] : '';

      const sectionHeaderRe = /^(experience|work history|professional experience|employment|career|education|academic|skills|summary|profile|certifi|achieve|award)/i;
      const resolvedTitle = (prevLine && !dateRangeRe.test(prevLine) && !sectionHeaderRe.test(prevLine))
        ? prevLine
        : '';
      const resolvedCompany = (prev2Line && !dateRangeRe.test(prev2Line) && !sectionHeaderRe.test(prev2Line) && prev2Line !== name)
        ? prev2Line
        : '';

      current = {
        title: resolvedTitle,
        company: resolvedCompany,
        dates: (line.match(dateRangeRe) || [''])[0],
        bullets: [],
      };
      mode = 'work';
      continue;
    }

    if (current && mode === 'work' && /^[•\-\*●▪]/.test(line)) {
      current.bullets.push(line.replace(/^[•\-\*●▪]\s*/, ''));
    }
  }

  if (current) workEntries.push(current);

  return {
    name,
    contactLine: locationAndPhone2.join('  |  '),
    contactLine2: emailAndLinks2.join('  |  '),
    workEntries: workEntries.filter((e) => e.title || e.company || e.bullets.length > 0),
    educationLines: educationLines.slice(0, 8),
  };
};

/**
 * Parse primary resume from base64-encoded file buffer.
 */
export const parsePrimaryResumeText = async (fileName: string, fileUrl: string): Promise<string> => {
  if (!fileUrl.includes(',')) return '';

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
