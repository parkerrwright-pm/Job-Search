import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, asyncHandler, authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/dashboard/overview - Dashboard overview stats
 */
router.get(
  '/overview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get job counts by stage
    const jobsByStage = await prisma.job.groupBy({
      by: ['stage'],
      where: { userId: req.userId! },
      _count: true,
    });

    // Total applications this week
    const thisWeekApplications = await prisma.job.count({
      where: {
        userId: req.userId!,
        appliedAt: { gte: weekAgo },
      },
    });

    // Total applications this month
    const thisMonthApplications = await prisma.job.count({
      where: {
        userId: req.userId!,
        appliedAt: { gte: monthAgo },
      },
    });

    // Jobs awaiting follow-up
    const followUpsNeeded = await prisma.job.count({
      where: {
        userId: req.userId!,
        followUpDate: { lte: now },
        lastFollowUpAt: null,
      },
    });

    // Upcoming interviews
    const upcomingInterviews = await prisma.interviewPrep.count({
      where: { userId: req.userId! },
    });

    const stats = {
      jobsByStage: Object.fromEntries(
        jobsByStage.map((group) => [group.stage, group._count])
      ),
      thisWeekApplications,
      thisMonthApplications,
      followUpsNeeded,
      upcomingInterviews,
      totalJobs: await prisma.job.count({ where: { userId: req.userId! } }),
    };

    res.json(stats);
  })
);

/**
 * GET /api/dashboard/upcoming-interviews - Upcoming interviews
 */
router.get(
  '/upcoming-interviews',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const interviews = await prisma.interviewPrep.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json(interviews);
  })
);

/**
 * GET /api/dashboard/follow-ups - Follow-ups due
 */
router.get(
  '/follow-ups',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();

    const followUps = await prisma.job.findMany({
      where: {
        userId: req.userId!,
        followUpDate: { not: null, lte: now },
      },
      orderBy: { followUpDate: 'asc' },
      take: 20,
    });

    res.json(followUps);
  })
);

/**
 * GET /api/dashboard/weekly-summary - This week summary
 */
router.get(
  '/weekly-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const applications = await prisma.job.findMany({
      where: {
        userId: req.userId!,
        appliedAt: { gte: weekAgo },
      },
      select: {
        title: true,
        company: true,
        appliedAt: true,
        stage: true,
      },
    });

    const topCompanies = applications
      .reduce(
        (acc, job) => {
          const existing = acc.find((c) => c.company === job.company);
          if (existing) {
            existing.count++;
          } else {
            acc.push({ company: job.company, count: 1 });
          }
          return acc;
        },
        [] as any[]
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      totalApplications: applications.length,
      applications,
      topCompanies,
    });
  })
);

/**
 * GET /api/dashboard/pipeline - Full pipeline view
 */
router.get(
  '/pipeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const jobs = await prisma.job.findMany({
      where: { userId: req.userId! },
      include: { analyses: { take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });

    // Group by stage (Kanban board format)
    const pipeline = {
      SAVED: [] as any[],
      APPLIED: [] as any[],
      RECRUITER_SCREEN: [] as any[],
      HIRING_MANAGER: [] as any[],
      PANEL: [] as any[],
      FINAL: [] as any[],
      OFFER: [] as any[],
      REJECTED: [] as any[],
    };

    jobs.forEach((job) => {
      pipeline[job.stage as keyof typeof pipeline].push(job);
    });

    res.json(pipeline);
  })
);

export default router;
