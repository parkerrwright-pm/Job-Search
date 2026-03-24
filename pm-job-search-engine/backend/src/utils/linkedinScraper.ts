// ─── LinkedIn Profile Scraper via Apify ──────────────────────────────────────
// Scrapes a LinkedIn profile using the Apify LinkedIn Profile Scraper actor.
// Called once when the user adds/changes their LinkedIn URL in settings.

import axios from 'axios';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';
const APIFY_LINKEDIN_ACTOR = 'api_store~linkedin-profile-scraper';

export interface LinkedInProfileData {
  scrapedAt: string;
  linkedinUrl: string;
  fullName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  industry?: string;
  connections?: number;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  certifications: string[];
  languages: string[];
  volunteerWork: string[];
  raw?: Record<string, unknown>;
}

export interface LinkedInExperience {
  title?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LinkedInEducation {
  school?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Scrape a LinkedIn profile using Apify's LinkedIn Profile Scraper actor.
 * Returns structured profile data or null on failure.
 */
export async function scrapeLinkedInProfile(linkedinUrl: string): Promise<LinkedInProfileData | null> {
  const token = APIFY_API_TOKEN;
  if (!token) {
    console.warn('[LinkedInScraper] No APIFY_API_TOKEN configured, skipping scrape');
    return null;
  }

  // Normalize URL
  let normalizedUrl = linkedinUrl.trim();
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  if (!normalizedUrl.includes('linkedin.com/in/')) {
    console.warn(`[LinkedInScraper] Invalid LinkedIn URL: ${normalizedUrl}`);
    return null;
  }

  try {
    console.log(`[LinkedInScraper] Starting Apify scrape for: ${normalizedUrl}`);

    // Run the actor synchronously (waits for completion)
    const response = await axios.post(
      `https://api.apify.com/v2/acts/${APIFY_LINKEDIN_ACTOR}/run-sync-get-dataset-items`,
      {
        startUrls: [{ url: normalizedUrl }],
        maxItems: 1,
        proxy: {
          useApifyProxy: true,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          token,
        },
        timeout: 120000, // 2 minute timeout for actor run
      }
    );

    const items = response.data;
    if (!Array.isArray(items) || items.length === 0) {
      console.warn('[LinkedInScraper] Actor returned no items');
      return null;
    }

    const profile = items[0];
    return parseApifyProfile(profile, normalizedUrl);
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.error?.message || error.message;
    console.error(`[LinkedInScraper] Apify scrape failed (HTTP ${status}): ${message}`);
    return null;
  }
}

/**
 * Parse raw Apify actor output into our structured format.
 */
function parseApifyProfile(raw: Record<string, any>, linkedinUrl: string): LinkedInProfileData {
  const experience: LinkedInExperience[] = (raw.experience || raw.positions || []).map((e: any) => ({
    title: e.title || e.jobTitle || '',
    company: e.companyName || e.company || '',
    location: e.location || e.locationName || '',
    startDate: e.startDate || e.dateRange?.split(' – ')?.[0] || '',
    endDate: e.endDate || e.dateRange?.split(' – ')?.[1] || '',
    description: e.description || '',
  }));

  const education: LinkedInEducation[] = (raw.education || raw.schools || []).map((e: any) => ({
    school: e.schoolName || e.school || e.institutionName || '',
    degree: e.degreeName || e.degree || '',
    fieldOfStudy: e.fieldOfStudy || e.field || '',
    startDate: e.startDate || '',
    endDate: e.endDate || '',
  }));

  const skills: string[] = Array.isArray(raw.skills)
    ? raw.skills.map((s: any) => (typeof s === 'string' ? s : s.name || s.skill || '')).filter(Boolean)
    : [];

  const certifications: string[] = Array.isArray(raw.certifications)
    ? raw.certifications.map((c: any) => (typeof c === 'string' ? c : c.name || '')).filter(Boolean)
    : [];

  const languages: string[] = Array.isArray(raw.languages)
    ? raw.languages.map((l: any) => (typeof l === 'string' ? l : l.name || '')).filter(Boolean)
    : [];

  const volunteerWork: string[] = Array.isArray(raw.volunteerExperience || raw.volunteer)
    ? (raw.volunteerExperience || raw.volunteer).map((v: any) =>
        typeof v === 'string' ? v : `${v.role || v.title || ''} at ${v.organization || v.company || ''}`.trim()
      ).filter(Boolean)
    : [];

  return {
    scrapedAt: new Date().toISOString(),
    linkedinUrl,
    fullName: raw.fullName || raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || undefined,
    headline: raw.headline || raw.title || undefined,
    summary: raw.summary || raw.about || undefined,
    location: raw.location || raw.addressLocality || raw.geoLocation || undefined,
    industry: raw.industry || undefined,
    connections: typeof raw.connections === 'number' ? raw.connections
      : typeof raw.connectionsCount === 'number' ? raw.connectionsCount
      : undefined,
    experience,
    education,
    skills,
    certifications,
    languages,
    volunteerWork,
    raw,
  };
}

/**
 * Build a concise text summary of a LinkedIn profile for use in alignment
 * rating prompts. Returns empty string if no data.
 */
export function buildLinkedInProfileSummary(profile: LinkedInProfileData | null): string {
  if (!profile) return '';

  const sections: string[] = [];

  if (profile.headline) {
    sections.push(`HEADLINE: ${profile.headline}`);
  }

  if (profile.summary) {
    sections.push(`SUMMARY: ${profile.summary.slice(0, 1000)}`);
  }

  if (profile.experience.length > 0) {
    const expLines = profile.experience.slice(0, 8).map((e) => {
      const period = [e.startDate, e.endDate].filter(Boolean).join(' - ');
      const line = `- ${e.title || 'Role'} at ${e.company || 'Company'}${period ? ` (${period})` : ''}`;
      return e.description ? `${line}: ${e.description.slice(0, 200)}` : line;
    });
    sections.push(`EXPERIENCE:\n${expLines.join('\n')}`);
  }

  if (profile.education.length > 0) {
    const eduLines = profile.education.slice(0, 4).map((e) => {
      const degree = [e.degree, e.fieldOfStudy].filter(Boolean).join(' in ');
      return `- ${degree || 'Degree'} from ${e.school || 'School'}`;
    });
    sections.push(`EDUCATION:\n${eduLines.join('\n')}`);
  }

  if (profile.skills.length > 0) {
    sections.push(`SKILLS: ${profile.skills.slice(0, 25).join(', ')}`);
  }

  if (profile.certifications.length > 0) {
    sections.push(`CERTIFICATIONS: ${profile.certifications.slice(0, 10).join(', ')}`);
  }

  return sections.join('\n\n');
}
