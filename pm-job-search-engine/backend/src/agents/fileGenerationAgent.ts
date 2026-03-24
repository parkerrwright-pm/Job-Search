// ─── File Generation Agent (Sub-Agent 7) ──────────────────────────────────────
// Responsible for generating Word (DOCX) and PDF files from TailoredResumeOutput.

import { PrismaClient } from '@prisma/client';
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import { TailoredResumeOutput } from './types';
import { chunkSkills, formatBullets } from './shared';
import {
  extractSelectedPrimaryResumeId,
  getPrimaryResumeText,
  getDocxTemplateBuffer,
} from './inputResolutionAgent';
import { parseResumeStructure } from './parsingAgent';

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const prisma = new PrismaClient();

/**
 * Render DOCX using a template with {{placeholders}} via Docxtemplater.
 */
export const renderWithDocxTemplate = async (
  templateBuffer: Buffer,
  output: TailoredResumeOutput,
): Promise<Buffer> => {
  const preCheckZip = new PizZip(templateBuffer);
  const rawDocXml = preCheckZip.file('word/document.xml')?.asText() || '';
  if (!rawDocXml.includes('{{')) {
    throw new Error(
      'Template DOCX has no {{placeholder}} merge fields. ' +
      'Download the merge-ready template from Settings and re-upload it.',
    );
  }

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  doc.render({
    headline: output.headline,
    target_role: output.targetRole,
    target_company: output.targetCompany,
    generated_at: new Date(output.generatedAt).toLocaleString(),
    summary: output.summary,
    skills: formatBullets(output.skills),
    experience: (output.experience || []).map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location || '',
      dates: e.dates,
      scope: e.scope || '',
      bullets: formatBullets(e.bullets),
    })),
    experience_bullets: formatBullets(output.experienceBullets),
    education: (output.education || []).map((e) => ({
      degree: e.degree,
      institution: e.institution,
      year: e.year || '',
    })),
    certifications: formatBullets(output.certifications || []),
    keywords_added: formatBullets(output.keywordsAdded),
    ats_recommendations: formatBullets(output.atsRecommendations),
  });

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

/**
 * Build a complete, ATS-ready DOCX resume programmatically.
 */
export const buildCompleteResumeDocx = async (
  output: TailoredResumeOutput,
  primaryResumeText: string,
): Promise<Buffer> => {
  const parsed = parseResumeStructure(primaryResumeText);
  const candidateName = parsed.name || output.targetRole;

  const sectionHead = (title: string) =>
    new Paragraph({
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: '1e3a5f' })],
      spacing: { before: 300, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8', space: 1 } },
    });

  const bulletPara = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text: `\u2022  ${text}`, size: 21 })],
      spacing: { before: 40, after: 40 },
      indent: { left: 360 },
    });

  const expParagraphs: Paragraph[] = [];
  const hasAiExperience = Array.isArray(output.experience) && output.experience.length > 0;

  if (hasAiExperience) {
    for (const entry of output.experience) {
      const parts: TextRun[] = [];
      if (entry.title) parts.push(new TextRun({ text: entry.title, bold: true, size: 22 }));
      if (entry.company) parts.push(new TextRun({ text: `  –  ${entry.company}`, size: 22 }));
      if (entry.location) parts.push(new TextRun({ text: `, ${entry.location}`, size: 20, color: '64748b' }));
      if (entry.dates) parts.push(new TextRun({ text: `  |  ${entry.dates}`, italics: true, size: 20, color: '64748b' }));
      if (parts.length > 0) {
        expParagraphs.push(new Paragraph({ children: parts, spacing: { before: 200, after: 60 } }));
      }
      if (entry.scope) {
        expParagraphs.push(new Paragraph({
          children: [new TextRun({ text: entry.scope, italics: true, size: 20, color: '64748b' })],
          spacing: { after: 40 },
        }));
      }
      entry.bullets.forEach((b) => expParagraphs.push(bulletPara(b)));
    }
  } else if (parsed.workEntries.length > 0) {
    for (const entry of parsed.workEntries.slice(0, 6)) {
      const parts: TextRun[] = [];
      if (entry.title) parts.push(new TextRun({ text: entry.title, bold: true, size: 22 }));
      if (entry.company) parts.push(new TextRun({ text: `  –  ${entry.company}`, size: 22 }));
      if (entry.dates) parts.push(new TextRun({ text: `  |  ${entry.dates}`, italics: true, size: 20, color: '64748b' }));
      if (parts.length > 0) {
        expParagraphs.push(new Paragraph({ children: parts, spacing: { before: 200, after: 60 } }));
      }
      entry.bullets.slice(0, 5).forEach((b) => expParagraphs.push(bulletPara(b)));
    }
  } else if (output.experienceBullets.length > 0) {
    output.experienceBullets.forEach((b) => expParagraphs.push(bulletPara(b)));
  }

  if (expParagraphs.length === 0) {
    expParagraphs.push(new Paragraph({ children: [new TextRun({ text: 'No experience entries found.', size: 21 })] }));
  }

  const skillRows = chunkSkills(output.skills);

  const educationParagraphs: Paragraph[] = [];
  if (output.education && output.education.length > 0) {
    for (const ed of output.education) {
      const edText = [ed.degree, ed.institution, ed.year].filter(Boolean).join(' — ');
      educationParagraphs.push(
        new Paragraph({ children: [new TextRun({ text: edText, size: 21 })], spacing: { before: 60, after: 40 } }),
      );
    }
  } else if (parsed.educationLines.length > 0) {
    for (const l of parsed.educationLines) {
      educationParagraphs.push(
        new Paragraph({ children: [new TextRun({ text: l, size: 21 })], spacing: { before: 60, after: 40 } }),
      );
    }
  }

  const certParagraphs: Paragraph[] = [];
  if (output.certifications && output.certifications.length > 0) {
    for (const c of output.certifications) {
      certParagraphs.push(
        new Paragraph({ children: [new TextRun({ text: c, size: 21 })], spacing: { before: 60, after: 40 } }),
      );
    }
  }

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: candidateName, bold: true, size: 36, color: '1e3a5f' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
    }),
    ...(parsed.contactLine
      ? [
          new Paragraph({
            children: [new TextRun({ text: parsed.contactLine, size: 20, color: '475569' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 20 },
          }),
        ]
      : []),
    ...(parsed.contactLine2
      ? [
          new Paragraph({
            children: [new TextRun({ text: parsed.contactLine2, size: 20, color: '475569' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
          }),
        ]
      : []),
    new Paragraph({
      children: [new TextRun({ text: output.headline, italics: true, size: 22, color: '334155' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
    }),
    sectionHead('Professional Summary'),
    new Paragraph({
      children: [new TextRun({ text: output.summary, size: 21 })],
      spacing: { before: 100, after: 80 },
    }),
    sectionHead('Core Skills'),
    ...(skillRows.length > 0
      ? skillRows.map(
          (row) => new Paragraph({ children: [new TextRun({ text: row, size: 21 })], spacing: { before: 50, after: 40 } }),
        )
      : [new Paragraph({ children: [new TextRun({ text: 'No skills listed.', size: 21 })] })]),
    sectionHead('Professional Experience'),
    ...expParagraphs,
    ...(educationParagraphs.length > 0
      ? [sectionHead('Education'), ...educationParagraphs]
      : []),
    ...(certParagraphs.length > 0
      ? [sectionHead('Certifications'), ...certParagraphs]
      : []),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 576, left: 720 } },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
};

/**
 * Build Word buffer — tries template merge first, falls back to generated DOCX.
 */
export const buildWordBuffer = async (
  output: TailoredResumeOutput,
  userId: string,
  jobId: string,
): Promise<Buffer> => {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { customFields: true } });
  const customFields =
    job?.customFields && typeof job.customFields === 'object' && !Array.isArray(job.customFields)
      ? (job.customFields as Record<string, any>)
      : {};
  const selectedTemplateResumeId =
    typeof customFields.selectedTemplateResumeId === 'string'
      ? customFields.selectedTemplateResumeId
      : undefined;

  const template = await getDocxTemplateBuffer(userId, selectedTemplateResumeId);
  if (template?.buffer) {
    const preCheckZip = new PizZip(template.buffer);
    const rawDocXml = preCheckZip.file('word/document.xml')?.asText() || '';
    if (rawDocXml.includes('{{')) {
      try {
        return await renderWithDocxTemplate(template.buffer, output);
      } catch (error) {
        console.warn(`Merge-template rendering failed for "${template.fileName}", falling back to generated DOCX.`, error);
      }
    }
  }

  const primaryResumeText = await getPrimaryResumeText(userId, extractSelectedPrimaryResumeId(job));
  return buildCompleteResumeDocx(output, primaryResumeText);
};

/**
 * Build PDF buffer from tailored output.
 */
export const buildPdfBuffer = async (output: TailoredResumeOutput, userId: string, jobId: string): Promise<Buffer> => {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { customFields: true } });
  const primaryResumeText = await getPrimaryResumeText(userId, extractSelectedPrimaryResumeId(job));
  const parsed = parseResumeStructure(primaryResumeText);
  const candidateName = parsed.name || output.targetRole;
  const hasAiExperience = Array.isArray(output.experience) && output.experience.length > 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const DARK_BLUE = '#1e3a5f';
    const GRAY = '#475569';
    const LINE_COLOR = '#cbd5e1';
    const LEFT = 54;
    const RIGHT = 558;

    const drawSectionLine = () => {
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor(LINE_COLOR).lineWidth(0.5).stroke().moveDown(0.3);
    };

    const sectionHead = (title: string) => {
      doc.moveDown(0.6);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK_BLUE).text(title.toUpperCase());
      drawSectionLine();
      doc.font('Helvetica').fillColor('#111111');
    };

    const bulletItem = (text: string) => {
      doc.fontSize(10).text(`\u2022  ${text}`, { indent: 10 }).moveDown(0.05);
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').fillColor(DARK_BLUE).text(candidateName, { align: 'center' });

    if (parsed.contactLine) {
      doc.moveDown(0.15).fontSize(9.5).font('Helvetica').fillColor(GRAY).text(parsed.contactLine, { align: 'center' });
    }
    if (parsed.contactLine2) {
      doc.moveDown(0.1).fontSize(9.5).font('Helvetica').fillColor(GRAY).text(parsed.contactLine2, { align: 'center' });
    }
    doc.moveDown(0.15).fontSize(10.5).font('Helvetica-Oblique').fillColor(GRAY).text(output.headline, { align: 'center' });
    doc.moveDown(0.5).font('Helvetica').fillColor('#111111');

    // Professional Summary
    sectionHead('Professional Summary');
    doc.fontSize(10).text(output.summary || 'Summary not available.').moveDown(0.3);

    // Core Skills
    sectionHead('Core Skills');
    const skillRows = chunkSkills(output.skills);
    skillRows.forEach((row) => doc.fontSize(10).text(row).moveDown(0.05));
    doc.moveDown(0.2);

    // Professional Experience
    sectionHead('Professional Experience');

    if (hasAiExperience) {
      for (const entry of output.experience) {
        doc.moveDown(0.35);
        const parts = [
          entry.title,
          entry.company ? `– ${entry.company}` : '',
          entry.location ? `, ${entry.location}` : '',
          entry.dates ? `| ${entry.dates}` : '',
        ].filter(Boolean).join('  ');
        doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#111111').text(parts);
        doc.font('Helvetica');
        if (entry.scope) {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b').text(entry.scope).moveDown(0.05);
          doc.font('Helvetica').fillColor('#111111');
        }
        entry.bullets.forEach((b) => bulletItem(b));
      }
    } else if (parsed.workEntries.length > 0) {
      for (const entry of parsed.workEntries.slice(0, 6)) {
        doc.moveDown(0.35);
        const parts = [
          entry.title,
          entry.company ? `– ${entry.company}` : '',
          entry.dates ? `| ${entry.dates}` : '',
        ].filter(Boolean).join('  ');
        doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#111111').text(parts);
        doc.font('Helvetica');
        entry.bullets.slice(0, 5).forEach((b) => bulletItem(b));
      }
    } else if (output.experienceBullets.length > 0) {
      output.experienceBullets.forEach((b) => bulletItem(b));
    }

    // Education
    if (output.education && output.education.length > 0) {
      sectionHead('Education');
      output.education.forEach((ed) => {
        const edText = [ed.degree, ed.institution, ed.year].filter(Boolean).join(' — ');
        doc.fontSize(10).text(edText);
      });
      doc.moveDown(0.15);
    } else if (parsed.educationLines.length > 0) {
      sectionHead('Education');
      parsed.educationLines.forEach((l) => doc.fontSize(10).text(l));
      doc.moveDown(0.15);
    }

    // Certifications
    if (output.certifications && output.certifications.length > 0) {
      sectionHead('Certifications');
      output.certifications.forEach((c) => doc.fontSize(10).text(c));
      doc.moveDown(0.15);
    }

    doc.end();
  });
};
