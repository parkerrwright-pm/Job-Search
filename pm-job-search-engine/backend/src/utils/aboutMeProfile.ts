import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const candidateRoots = [
  resolve(__dirname, '..', '..', '..'),
  resolve(__dirname, '..', '..', '..', '..', 'PM_Job_Search_Engine'),
];

const normalizeWhitespace = (value: string): string => {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const cleanMarkdownArtifacts = (value: string): string => {
  return value
    .replace(/:contentReference\[[^\]]*\]\{[^}]*\}/g, '')
    .replace(/^#+\s*/gm, '')
    .trim();
};

export const getAboutMeProfileText = async (): Promise<string> => {
  for (const root of candidateRoots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      const aboutMeFile = entries.find((entry) => entry.isFile() && /aboutme\.md$/i.test(entry.name));
      if (!aboutMeFile) continue;

      const raw = await readFile(resolve(root, aboutMeFile.name), 'utf8');
      const cleaned = normalizeWhitespace(cleanMarkdownArtifacts(raw));
      if (cleaned) {
        return cleaned.slice(0, 6000);
      }
    } catch (error) {
      console.warn('AboutMe profile loading failed:', error);
    }
  }

  return '';
};

export const appendAboutMeContext = async (resumeText: string): Promise<string> => {
  const base = (resumeText || '').trim();
  const aboutMe = await getAboutMeProfileText();

  if (!aboutMe) {
    return base;
  }

  if (base.includes('CANDIDATE ABOUT PROFILE:')) {
    return base;
  }

  if (!base) {
    return `CANDIDATE ABOUT PROFILE:\n${aboutMe}`;
  }

  return `${base}\n\nCANDIDATE ABOUT PROFILE:\n${aboutMe}`;
};