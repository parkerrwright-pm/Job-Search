import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { AuthRequest, asyncHandler, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AIService } from '../utils/aiService';
import { scrapeLinkedInProfile, LinkedInProfileData } from '../utils/linkedinScraper';
import { computeAlignmentRating } from '../agents';

const router = Router();
const prisma = new PrismaClient();
const pdfParse = require('pdf-parse');

router.use(authenticate);

const truncateText = (value: string, maxLen: number): string => {
  if (!value) return '';
  return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
};

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const extractLinkedInHandle = (linkedinUrl: string): string | null => {
  try {
    const withProtocol = linkedinUrl.startsWith('http')
      ? linkedinUrl
      : `https://${linkedinUrl}`;
    const parsed = new URL(withProtocol);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'in') {
      return parts[1];
    }
    return null;
  } catch {
    return null;
  }
};

const getLinkedInPageText = async (linkedinUrl: string): Promise<string> => {
  const withProtocol = linkedinUrl.startsWith('http')
    ? linkedinUrl
    : `https://${linkedinUrl}`;

  try {
    const response = await axios.get(withProtocol, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    $('script, style, noscript').remove();
    const title = $('title').text() || '';
    const description = $('meta[name="description"]').attr('content') || '';
    const bodyText = $('body').text() || '';

    const merged = normalizeWhitespace(`${title} ${description} ${bodyText}`);
    if (merged.length > 200) {
      return truncateText(merged, 6000);
    }
  } catch (error) {
    // Fall through to best-effort fallback based on URL handle.
  }

  const handle = extractLinkedInHandle(withProtocol);
  if (handle) {
    return `LinkedIn profile URL: ${withProtocol}. Candidate handle appears to be ${handle}.`;
  }

  return `LinkedIn profile URL: ${withProtocol}`;
};

const getPrimaryResumeText = async (fileUrl: string, mimeType: string): Promise<string> => {
  if (!fileUrl || !fileUrl.includes(',')) {
    throw new AppError(400, 'Primary resume file data is invalid');
  }

  const base64 = fileUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  const type = (mimeType || '').toLowerCase();

  if (type.includes('pdf')) {
    const parsed = await pdfParse(buffer);
    return truncateText(normalizeWhitespace(parsed.text || ''), 12000);
  }

  if (type.includes('wordprocessingml.document')) {
    const parsed = await mammoth.extractRawText({ buffer });
    return truncateText(normalizeWhitespace(parsed.value || ''), 12000);
  }

  if (type.includes('msword')) {
    throw new AppError(400, 'Legacy .doc parsing is not supported for auto-fill. Please upload PDF or DOCX.');
  }

  return truncateText(normalizeWhitespace(buffer.toString('utf8')), 12000);
};

const fallbackHeadline = (resumeSource: string): string => {
  const pmMatch = resumeSource.match(/(product manager|senior product manager|group product manager)/i);
  if (pmMatch?.[1]) {
    return `${pmMatch[1].replace(/\b\w/g, (c) => c.toUpperCase())} | Product Strategy and Execution`;
  }
  return 'Product Manager | Strategy, Execution, and Cross-Functional Leadership';
};

const fallbackBio = (resumeSource: string, linkedinSource: string): string => {
  const source = normalizeWhitespace(`${resumeSource} ${linkedinSource}`);
  if (!source) {
    return 'Product manager focused on building customer-centered products, leading cross-functional teams, and driving measurable business outcomes.';
  }

  const snippet = truncateText(source, 520);
  return `Product manager with experience leading cross-functional initiatives from discovery through launch.\n\nBackground highlights: ${snippet}`;
};

/**
 * GET /api/settings - Get user settings
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        linkedinUrl: true,
        portfolioUrl: true,
        preferredLLM: true,
        aiPreferences: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json(user);
  })
);

/**
 * PUT /api/settings - Update user settings
 * When linkedinUrl changes, triggers an Apify scrape in the background (once).
 */
router.put(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      firstName,
      lastName,
      headline,
      bio,
      linkedinUrl,
      portfolioUrl,
      preferredLLM,
      aiPreferences,
    } = req.body;

    // Fetch current user to detect LinkedIn URL changes
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { linkedinUrl: true },
    });

    const data: Record<string, unknown> = {};

    // Use explicit undefined checks so values like empty strings can still be persisted.
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (headline !== undefined) data.headline = headline;
    if (bio !== undefined) data.bio = bio;
    if (linkedinUrl !== undefined) data.linkedinUrl = linkedinUrl;
    if (portfolioUrl !== undefined) data.portfolioUrl = portfolioUrl;
    if (preferredLLM !== undefined) data.preferredLLM = preferredLLM;
    if (aiPreferences !== undefined) data.aiPreferences = aiPreferences;

    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        linkedinUrl: true,
        portfolioUrl: true,
        preferredLLM: true,
        aiPreferences: true,
      },
    });

    // Trigger LinkedIn scrape if URL changed (non-blocking background task)
    const linkedinUrlChanged =
      linkedinUrl !== undefined &&
      linkedinUrl &&
      linkedinUrl !== currentUser?.linkedinUrl;

    if (linkedinUrlChanged) {
      triggerLinkedInScrape(req.userId!, linkedinUrl).catch((err) =>
        console.error('[Settings] Background LinkedIn scrape failed:', err)
      );
    }

    res.json(updated);
  })
);

/**
 * Background: Scrape LinkedIn profile via Apify, store result, re-rate all jobs.
 */
async function triggerLinkedInScrape(userId: string, linkedinUrl: string): Promise<void> {
  console.log(`[LinkedInScrape] Starting for user ${userId}: ${linkedinUrl}`);

  const profileData = await scrapeLinkedInProfile(linkedinUrl);
  if (!profileData) {
    console.warn(`[LinkedInScrape] No data returned for ${linkedinUrl}`);
    return;
  }

  // Store the scraped profile data
  await prisma.user.update({
    where: { id: userId },
    data: { linkedinProfileData: profileData as any },
  });
  console.log(`[LinkedInScrape] Profile cached for user ${userId}`);

  // Re-rate all existing jobs with the new LinkedIn data
  const jobs = await prisma.job.findMany({
    where: { userId },
    select: { id: true },
  });

  console.log(`[LinkedInScrape] Re-rating ${jobs.length} jobs with LinkedIn data...`);
  for (const job of jobs) {
    try {
      await computeAlignmentRating(job.id, userId);
    } catch (err) {
      console.warn(`[LinkedInScrape] Re-rate failed for job ${job.id}:`, err);
    }
  }
  console.log(`[LinkedInScrape] Done re-rating ${jobs.length} jobs`);
}

/**
 * GET /api/settings/linkedin-profile - Get cached LinkedIn profile status & data
 */
router.get(
  '/linkedin-profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        linkedinUrl: true,
        linkedinProfileData: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const profileData = user.linkedinProfileData as LinkedInProfileData | null;

    res.json({
      linkedinUrl: user.linkedinUrl || null,
      hasProfileData: Boolean(profileData),
      scrapedAt: profileData?.scrapedAt || null,
      profileSummary: profileData
        ? {
            fullName: profileData.fullName || null,
            headline: profileData.headline || null,
            location: profileData.location || null,
            skillsCount: profileData.skills?.length || 0,
            experienceCount: profileData.experience?.length || 0,
            educationCount: profileData.education?.length || 0,
          }
        : null,
    });
  })
);

/**
 * POST /api/settings/linkedin-rescrape - Force re-scrape of LinkedIn profile
 */
router.post(
  '/linkedin-rescrape',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { linkedinUrl: true },
    });

    if (!user?.linkedinUrl) {
      throw new AppError(400, 'No LinkedIn URL configured. Add one in settings first.');
    }

    // Run synchronously so the user gets a response when done
    const profileData = await scrapeLinkedInProfile(user.linkedinUrl);
    if (!profileData) {
      throw new AppError(502, 'LinkedIn scrape failed. The profile may be private or Apify may be unavailable.');
    }

    await prisma.user.update({
      where: { id: req.userId! },
      data: { linkedinProfileData: profileData as any },
    });

    // Re-rate all jobs in background
    const userId = req.userId!;
    prisma.job.findMany({ where: { userId }, select: { id: true } }).then(async (jobs) => {
      for (const job of jobs) {
        await computeAlignmentRating(job.id, userId).catch(() => {});
      }
      console.log(`[LinkedInRescrape] Re-rated ${jobs.length} jobs`);
    });

    res.json({
      success: true,
      scrapedAt: profileData.scrapedAt,
      profileSummary: {
        fullName: profileData.fullName || null,
        headline: profileData.headline || null,
        location: profileData.location || null,
        skillsCount: profileData.skills?.length || 0,
        experienceCount: profileData.experience?.length || 0,
        educationCount: profileData.education?.length || 0,
      },
    });
  })
);

/**
 * POST /api/settings/auto-populate-profile
 * Generate headline and bio from primary resume + LinkedIn source, then persist.
 */
router.post(
  '/auto-populate-profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { linkedinUrl: linkedinUrlInput } = req.body || {};

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        linkedinUrl: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const linkedinUrl = linkedinUrlInput || user.linkedinUrl;
    if (!linkedinUrl) {
      throw new AppError(400, 'LinkedIn URL is required before auto-populating profile');
    }

    const primaryResume = await prisma.resume.findFirst({
      where: {
        userId: req.userId!,
        isPrimary: true,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        mimeType: true,
      },
    });

    if (!primaryResume) {
      throw new AppError(400, 'Primary resume is required before auto-populating profile');
    }

    const resumeSource = await getPrimaryResumeText(
      primaryResume.fileUrl,
      primaryResume.mimeType,
    );
    const linkedinSource = await getLinkedInPageText(linkedinUrl);

    let headline = '';
    let bio = '';

    try {
      const generated = await AIService.generateProfileFromSources(
        resumeSource,
        linkedinSource,
      );
      headline = (generated?.headline || '').trim();
      bio = (generated?.bio || '').trim();
    } catch (error) {
      // Fall back to deterministic text so users still get auto-populated fields.
      headline = fallbackHeadline(resumeSource);
      bio = fallbackBio(resumeSource, linkedinSource);
    }

    if (!headline) {
      headline = fallbackHeadline(resumeSource);
    }
    if (!bio) {
      bio = fallbackBio(resumeSource, linkedinSource);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        linkedinUrl,
        headline: truncateText(headline, 120),
        bio: truncateText(bio, 700),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        linkedinUrl: true,
        portfolioUrl: true,
        preferredLLM: true,
        aiPreferences: true,
      },
    });

    res.json({
      success: true,
      source: {
        usedPrimaryResume: true,
        linkedinUrl,
      },
      user: updatedUser,
    });
  })
);

/**
 * PUT /api/settings/ai-preferences - Update AI preferences
 */
router.put(
  '/ai-preferences',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { aiPreferences } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        aiPreferences: aiPreferences || {},
      },
    });

    res.json({ success: true, aiPreferences: updated.aiPreferences });
  })
);

/**
 * PUT /api/settings/notifications - Update notification settings
 */
router.put(
  '/notifications',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { notificationSettings } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        notificationSettings: notificationSettings || {},
      },
    });

    res.json({ success: true, notificationSettings: updated.notificationSettings });
  })
);

export default router;
