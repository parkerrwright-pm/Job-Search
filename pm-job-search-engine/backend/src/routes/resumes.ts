import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { AuthRequest, asyncHandler, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/resumes/merge-template - Download a merge-ready DOCX template
 * This template contains {{placeholder}} fields so the export engine can inject
 * tailored resume content. Download, customize visually, then re-upload as your
 * Template Resume in Settings.
 */
router.get(
  '/merge-template',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const makeHeading = (text: string) =>
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text, bold: true })],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB', space: 1 },
        },
        spacing: { after: 80, before: 240 },
      });

    const makeLabel = (text: string) =>
      new Paragraph({
        children: [
          new TextRun({ text, bold: true, italics: true, color: '6B7280', size: 18 }),
        ],
        spacing: { after: 60 },
      });

    const makePlaceholder = (field: string, description: string) =>
      new Paragraph({
        children: [
          new TextRun({ text: `{{${field}}}`, color: 'DC2626', bold: true }),
          new TextRun({ text: `  ← ${description}`, color: '9CA3AF', italics: true, size: 18 }),
        ],
        spacing: { after: 120 },
      });

    const doc = new Document({
      sections: [
        {
          children: [
            // ── Banner note ──
            new Paragraph({
              children: [
                new TextRun({
                  text: 'MERGE-READY RESUME TEMPLATE',
                  bold: true,
                  size: 28,
                  color: '1D4ED8',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Red {{tags}} will be replaced with AI-tailored content on export. ' +
                        'Customize fonts, colors, and layout in Word, then re-upload this file ' +
                        'as your Template Resume in Settings.',
                  italics: true,
                  color: '6B7280',
                  size: 18,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),

            // ── Personal headline ──
            new Paragraph({
              children: [new TextRun({ text: '{{headline}}', bold: true, size: 48, color: 'DC2626' })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: '{{target_role}}', bold: true, size: 24, color: 'DC2626' }),
                new TextRun({ text: '  |  ', size: 24, color: '6B7280' }),
                new TextRun({ text: '{{target_company}}', bold: true, size: 24, color: 'DC2626' }),
                new TextRun({ text: '  |  Generated: ', size: 22, color: '6B7280' }),
                new TextRun({ text: '{{generated_at}}', size: 22, color: 'DC2626' }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),

            // ── Professional Summary ──
            makeHeading('Professional Summary'),
            makeLabel('Replace this section with AI-tailored summary:'),
            makePlaceholder('summary', 'AI-generated professional summary will appear here'),

            // ── Core Skills ──
            makeHeading('Core Skills'),
            makeLabel('Replace this section with relevant skills from the job description:'),
            makePlaceholder('skills', 'Bulleted skill list will appear here'),

            // ── Experience Highlights ──
            makeHeading('Experience Highlights'),
            makeLabel('Replace with ATS-optimized experience bullets:'),
            makePlaceholder('experience_bullets', 'Rewritten and ATS-optimized bullets will appear here'),

            // ── Keywords Added ──
            makeHeading('ATS Keywords Added'),
            makeLabel('Keywords from the job description that were added to your resume:'),
            makePlaceholder('keywords_added', 'Job-description keywords inserted for ATS scoring'),

            // ── ATS Recommendations ──
            makeHeading('ATS Recommendations'),
            makeLabel('Suggestions to further improve your ATS score:'),
            makePlaceholder('ats_recommendations', 'Recommendations to maximize ATS score will appear here'),

            // ── Customization tip ──
            new Paragraph({
              children: [
                new TextRun({
                  text: 'TIP: Add your contact info, work history dates, and education above or below these sections. ' +
                        'Keep the {{placeholder}} tags exactly as shown — the export engine replaces them at generation time.',
                  italics: true,
                  color: '6B7280',
                  size: 18,
                }),
              ],
              spacing: { before: 400 },
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="resume-merge-template.docx"');
    res.send(buffer);
  })
);

/**
 * GET /api/resumes - List all resume versions
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });

    res.json(resumes);
  })
);

/**
 * POST /api/resumes/upload - Upload resume file with base64 data
 */
router.post(
  '/upload',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fileName, fileData, fileSize, mimeType, title, isPrimary } = req.body;

    if (!fileName || !fileData) {
      throw new AppError(400, 'File name and file data are required');
    }

    // Get latest version number
    const latestResume = await prisma.resume.findFirst({
      where: { userId: req.userId! },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latestResume?.version || 0) + 1;

    // If isPrimary is true, unset all other primary resumes
    if (isPrimary) {
      await prisma.resume.updateMany({
        where: { userId: req.userId! },
        data: { isPrimary: false },
      });
    }

    // Create resume record with data URL
    const resume = await prisma.resume.create({
      data: {
        userId: req.userId!,
        fileName,
        fileUrl: `data:${mimeType};base64,${fileData}`, // Store as data URL
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/pdf',
        version: newVersion,
        title: title || `Resume v${newVersion}`,
        description: `Uploaded on ${new Date().toLocaleDateString()}`,
        isPrimary: isPrimary !== false, // Default to true if not specified
      },
    });

    res.status(201).json(resume);
  })
);

/**
 * POST /api/resumes - Upload new resume version (legacy)
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fileName, fileUrl, fileSize, mimeType, title, description } = req.body;

    if (!fileName || !fileUrl) {
      throw new AppError(400, 'File name and URL are required');
    }

    // Get latest version number
    const latestResume = await prisma.resume.findFirst({
      where: { userId: req.userId! },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latestResume?.version || 0) + 1;

    const resume = await prisma.resume.create({
      data: {
        userId: req.userId!,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/pdf',
        version: newVersion,
        title: title || `Resume v${newVersion}`,
        description,
        isPrimary: !latestResume, // First resume is primary
      },
    });

    res.status(201).json(resume);
  })
);

/**
 * GET /api/resumes/:id - Get specific resume
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const resume = await prisma.resume.findUnique({
      where: { id: req.params.id },
    });

    if (!resume || resume.userId !== req.userId) {
      throw new AppError(404, 'Resume not found');
    }

    res.json(resume);
  })
);

/**
 * PUT /api/resumes/:id - Update resume metadata
 */
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const resume = await prisma.resume.findUnique({
      where: { id: req.params.id },
    });

    if (!resume || resume.userId !== req.userId) {
      throw new AppError(404, 'Resume not found');
    }

    const updated = await prisma.resume.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(updated);
  })
);

/**
 * DELETE /api/resumes/:id - Delete resume version
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const resume = await prisma.resume.findUnique({
      where: { id: req.params.id },
    });

    if (!resume || resume.userId !== req.userId) {
      throw new AppError(404, 'Resume not found');
    }

    // Don't allow deleting if it's the only resume
    const count = await prisma.resume.count({ where: { userId: req.userId! } });
    if (count === 1) {
      throw new AppError(400, 'Cannot delete your only resume');
    }

    await prisma.resume.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  })
);

/**
 * PUT /api/resumes/:id/set-primary - Set as primary resume
 */
router.put(
  '/:id/set-primary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const resume = await prisma.resume.findUnique({
      where: { id: req.params.id },
    });

    if (!resume || resume.userId !== req.userId) {
      throw new AppError(404, 'Resume not found');
    }

    // Unset all other primary resumes
    await prisma.resume.updateMany({
      where: { userId: req.userId! },
      data: { isPrimary: false },
    });

    // Set this one as primary
    const updated = await prisma.resume.update({
      where: { id: req.params.id },
      data: { isPrimary: true },
    });

    res.json(updated);
  })
);

export default router;
