// ─── Shared Utilities for Sub-Agent Architecture ──────────────────────────────

import {
  ExperienceEntry,
  EducationEntry,
  TailoredResumeOutput,
} from './types';

export const clampNumber = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

export const normalizeScore = (value: any): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return clampNumber(value, 0, 100);

  if (typeof value === 'string') {
    const match = value.match(/\d{1,3}(?:\.\d+)?/);
    if (match) return clampNumber(Number(match[0]), 0, 100);
  }

  return 0;
};

export const normalizeStringList = (value: any): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const text = item.bullet || item.rewrite || item.text || item.keyword || '';
          return typeof text === 'string' ? text.trim() : '';
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/)
      .map((token) => token.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  return [];
};

export const normalizeExperienceEntries = (value: any): ExperienceEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e: any) => e && typeof e === 'object')
    .map((e: any) => ({
      title: typeof e.title === 'string' ? e.title.trim() : '',
      company: typeof e.company === 'string' ? e.company.trim() : '',
      location: typeof e.location === 'string' ? e.location.trim() : undefined,
      dates: typeof e.dates === 'string' ? e.dates.trim() : '',
      scope: typeof e.scope === 'string' ? e.scope.trim() : undefined,
      bullets: normalizeStringList(e.bullets),
    }))
    .filter((e: ExperienceEntry) => e.title || e.company || e.bullets.length > 0);
};

export const normalizeEducationEntries = (value: any): EducationEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e: any) => e && typeof e === 'object')
    .map((e: any) => ({
      degree: typeof e.degree === 'string' ? e.degree.trim() : '',
      institution: typeof e.institution === 'string' ? e.institution.trim() : '',
      year: typeof e.year === 'string' ? e.year.trim() : undefined,
    }))
    .filter((e: EducationEntry) => e.degree || e.institution);
};

export const isQuotaExceededError = (error: any): boolean => {
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

export const extractCandidateName = (text: string): string => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    lines.find(
      (l) =>
        l.length > 2 &&
        l.length < 70 &&
        !/@/.test(l) &&
        !/(http|www\.|linkedin\.com)/i.test(l) &&
        !/^\d/.test(l),
    ) || ''
  );
};

export const buildExportFilename = (name: string, role: string, company: string, ext: string): string => {
  const parts = [name, role, company].map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return `tailored-resume.${ext}`;
  // Strip characters illegal in filenames AND non-ASCII that break HTTP headers
  const safe = parts.join(' - ').replace(/[\/\\:*?"<>|]+/g, '').replace(/[^\x20-\x7E]/g, '').trim();
  return safe ? `${safe}.${ext}` : `tailored-resume.${ext}`;
};

export const extractLocationFromDescription = (jobDescription?: string): string | undefined => {
  if (!jobDescription) return undefined;

  const locationLabelMatch = jobDescription.match(/location\s*:\s*([^\n\r]+)/i);
  if (locationLabelMatch?.[1]) {
    return locationLabelMatch[1].trim();
  }

  const remoteMatch = jobDescription.match(/\b(remote|hybrid|on-site|onsite)\b/i);
  if (remoteMatch?.[1]) {
    const raw = remoteMatch[1].toLowerCase();
    if (raw === 'on-site' || raw === 'onsite') return 'On-site';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  return undefined;
};

export const extractSalaryFromDescription = (jobDescription?: string): string | undefined => {
  if (!jobDescription) return undefined;

  const salaryLabelMatch = jobDescription.match(/salary\s*:\s*([^\n\r]+)/i);
  if (salaryLabelMatch?.[1]) {
    return salaryLabelMatch[1].trim();
  }

  const rangeMatch = jobDescription.match(/\$\s?\d{2,3}[kK]\s?[-–to]+\s?\$?\s?\d{2,3}[kK]/);
  if (rangeMatch?.[0]) {
    return rangeMatch[0].replace(/\s+/g, ' ').trim();
  }

  const annualMatch = jobDescription.match(/\$\s?\d{2,3}(,\d{3})?(\s?[-–to]+\s?\$\s?\d{2,3}(,\d{3})?)?\s*(per year|\/year|annually)/i);
  if (annualMatch?.[0]) {
    return annualMatch[0].replace(/\s+/g, ' ').trim();
  }

  return undefined;
};

export const extractPriorityFromDescription = (jobDescription?: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  if (!jobDescription) return 'MEDIUM';

  if (/\b(urgent|asap|immediate|immediately|priority hire|expedite)\b/i.test(jobDescription)) {
    return 'HIGH';
  }

  if (/\b(entry level|intern|junior|nice to have|preferred)\b/i.test(jobDescription)) {
    return 'LOW';
  }

  return 'MEDIUM';
};

export const isFallbackAnalysisData = (analysisData: any): boolean => {
  // Check 1: explicit meta flag (set by newer code)
  if (analysisData?.meta?.usedFallbackContent === true) return true;

  // Check 2: detect hardcoded fallback pattern from older cached data
  const ats = analysisData?.sections?.atsVmockScore;
  if (ats && typeof ats === 'object') {
    const score = ats.currentScore ?? ats.overallScore ?? ats.atsScore;
    const kd = ats.keywordDensity;
    const av = ats.actionVerbsScore;
    const ms = ats.metricsScore;
    const sa = ats.skillsAlignmentScore;
    // Hallmark of fallback: score exactly 62, all subscores missing/zero
    if (
      score === 62 &&
      (kd === undefined || kd === 0) &&
      (av === undefined || av === 0) &&
      (ms === undefined || ms === 0) &&
      (sa === undefined || sa === 0)
    ) {
      return true;
    }
  }

  return false;
};

export const analysisNeedsRefresh = (analysisData: any): boolean => {
  if (!analysisData || typeof analysisData !== 'object') return true;
  if (!analysisData.sections || typeof analysisData.sections !== 'object') return true;
  if (isFallbackAnalysisData(analysisData)) return true;

  const keys = Object.keys(analysisData.sections);
  return keys.length < 8;
};

export const buildFallbackAnalysisMessage = (): string => {
  return (
    'AI analysis is currently running in fallback mode, so quality-gate scores are not reliable yet. ' +
    'This usually means the configured AI provider/model request failed. ' +
    'Verify backend AI settings (AI_PROVIDER, ANTHROPIC_API_KEY, ANTHROPIC_MODEL), restart the backend, and regenerate analysis.'
  );
};

export const formatBullets = (items: string[]): string => {
  if (!items.length) return '';
  return items.map((item) => `• ${item}`).join('\n');
};

export const chunkSkills = (skills: string[]): string[] => {
  const rows: string[] = [];
  for (let i = 0; i < skills.length; i += 4) {
    rows.push(skills.slice(i, i + 4).join('  |  '));
  }
  return rows;
};
