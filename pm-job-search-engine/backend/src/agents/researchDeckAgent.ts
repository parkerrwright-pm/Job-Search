import { AIService } from '../utils/aiService';

type DeckSection = {
  key: 'techStack' | 'techImprovements' | 'dbSchemaDesign' | 'sqlKpis' | 'aiOpportunities' | 'partnershipRevenue';
  title: string;
  bullets: string[];
  diagramDescription?: string;
  visualData?: Record<string, any>;
};

type DeckOutput = {
  title: string;
  subtitle?: string;
  sections: DeckSection[];
  metadata?: Record<string, any>;
};

type CreateResearchDeckParams = {
  job: {
    title?: string | null;
    company?: string | null;
    jobDescriptionText?: string | null;
    jobUrl?: string | null;
    customFields?: any;
  };
  userPrompt?: string;
  extensionTechData?: string;
  priorDeck?: any;
};

const REQUIRED_SECTION_KEYS: DeckSection['key'][] = [
  'techStack',
  'techImprovements',
  'dbSchemaDesign',
  'sqlKpis',
  'aiOpportunities',
  'partnershipRevenue',
];

const stripDomain = (input: string): string => {
  try {
    const parsed = new URL(input);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return String(input || '')
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();
  }
};

const normalizeList = (values: any[]): string[] =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );

const safeFetchText = async (url: string, timeoutMs = 3000): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PMJobSearchResearchDeck/1.0',
      },
      signal: controller.signal,
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

const parseW3TechsSignals = (html: string): string[] => {
  if (!html) return [];
  const matches = html.match(/<a[^>]*>([^<]+)<\/a>/gi) || [];
  const signals: string[] = [];
  for (const match of matches.slice(0, 200)) {
    const text = match.replace(/<[^>]+>/g, '').trim();
    if (text.length > 1 && text.length < 60) {
      signals.push(text);
    }
  }
  return normalizeList(signals).slice(0, 20);
};

const parseExtensionSignals = (raw: string): string[] => {
  const value = String(raw || '').trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeList(parsed.map((item) => item?.name || item?.technology || item));
    }
    if (Array.isArray(parsed?.technologies)) {
      return normalizeList(parsed.technologies.map((item: any) => item?.name || item?.technology || item));
    }
  } catch {
    return normalizeList(value.split(/[\n,;]+/g));
  }

  return [];
};

const parseFulSignals = (payload: any): string[] => {
  const technologies = payload?.technologies;
  if (!Array.isArray(technologies)) return [];
  return normalizeList(technologies.map((item: any) => item?.name || item?.technology || item));
};

const fetchFulSignals = async (companyUrl: string): Promise<string[]> => {
  const apiKey = (process.env.FULIO_API_KEY || '').trim();
  if (!apiKey || !companyUrl) {
    return [];
  }

  const endpoint = 'https://ful.io/api/v1/technology-lookup';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ domain: stripDomain(companyUrl) }),
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const payload = await response.json();
    return parseFulSignals(payload);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const extractTechStackFromJd = (jobDescription: string): string[] => {
  const source = String(jobDescription || '').toLowerCase();
  const dictionary = [
    'react',
    'next.js',
    'vue',
    'angular',
    'node.js',
    'typescript',
    'python',
    'java',
    'go',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
    'snowflake',
    'aws',
    'gcp',
    'azure',
    'kubernetes',
    'docker',
    'terraform',
    'datadog',
    'segment',
    'stripe',
  ];

  return dictionary.filter((tech) => source.includes(tech.toLowerCase()));
};

const getCompanyUrl = (job: CreateResearchDeckParams['job']): string => {
  const fromCustom =
    job?.customFields && typeof job.customFields === 'object' && !Array.isArray(job.customFields)
      ? String((job.customFields as Record<string, any>)?.companyUrl || '')
      : '';

  return String(fromCustom || job?.jobUrl || '').trim();
};

const buildPrompt = (params: {
  company: string;
  title: string;
  jobDescription: string;
  userPrompt: string;
  techSignals: string[];
  sources: string[];
  companyUrl: string;
  priorDeck?: any;
}): string => {
  const priorDeckSummary = params.priorDeck
    ? JSON.stringify(
        {
          title: params.priorDeck?.title,
          sections: Array.isArray(params.priorDeck?.sections)
            ? params.priorDeck.sections.map((section: any) => ({
                title: section?.title,
                bullets: Array.isArray(section?.bullets) ? section.bullets.slice(0, 3) : [],
              }))
            : [],
        },
        null,
        2,
      )
    : 'None';

  return `You are a senior Product Manager and CTO strategy advisor preparing a technical interview deck.

Context:
- Company: ${params.company}
- Role: ${params.title}
- Company URL: ${params.companyUrl || 'Unknown'}
- User context prompt: ${params.userPrompt || 'None'}

Problem statement:
You are in the final round of the shortlisting process for the Product Manager position at ${params.company}.
You have passed product sense, metrics, and behavioral rounds.
You are now preparing for a technical round with the CTO.
Create a presentation answering the required technical questions.

Existing deck to refine (if present):
${priorDeckSummary}

Inputs:
- Job description:\n${String(params.jobDescription || '').slice(0, 7000)}
- Detected technology signals (${params.sources.join(', ')}): ${params.techSignals.join(', ') || 'None'}

Return ONLY valid JSON with this shape:
{
  "deck": {
    "title": "string",
    "subtitle": "string",
    "sections": [
      {
        "key": "techStack|techImprovements|dbSchemaDesign|sqlKpis|aiOpportunities|partnershipRevenue",
        "title": "string",
        "bullets": ["string"],
        "diagramDescription": "string",
        "visualData": {}
      }
    ]
  }
}

Requirements:
- Exactly 6 sections in this order: techStack, techImprovements, dbSchemaDesign, sqlKpis, aiOpportunities, partnershipRevenue.
- Explicitly separate current-state tech stack from recommended improvements.
- 4-6 concise CTO-level bullets per section.
- SQL examples in sqlKpis bullets for user growth, engagement, revenue, and operational metrics.
- Include where AI can be applied, recommended tools, and business impact.
- Include a partnership and revenue model with integration/process flow.
- Keep output grounded in supplied evidence and call out assumptions.
- If existing deck is provided, update and improve it based on new user context rather than rewriting blindly.`;
};

const normalizeDeck = (deck: any): DeckOutput => {
  const rawSections = Array.isArray(deck?.sections) ? deck.sections : [];

  const byKey = new Map<string, any>();
  rawSections.forEach((section: any) => {
    const key = String(section?.key || '').trim();
    if (key) byKey.set(key, section);
  });

  const sections: DeckSection[] = REQUIRED_SECTION_KEYS.map((requiredKey) => {
    const source = byKey.get(requiredKey) || rawSections.find((s: any) => String(s?.key || '') === requiredKey);
    return {
      key: requiredKey,
      title: String(source?.title || requiredKey),
      bullets: Array.isArray(source?.bullets)
        ? source.bullets.map((bullet: any) => String(bullet || '').trim()).filter(Boolean).slice(0, 6)
        : [],
      diagramDescription: source?.diagramDescription ? String(source.diagramDescription) : undefined,
      visualData: source?.visualData && typeof source.visualData === 'object' ? source.visualData : undefined,
    };
  });

  if (sections.some((section) => section.bullets.length < 3)) {
    throw new Error('Generated deck did not contain enough structured bullet content');
  }

  return {
    title: String(deck?.title || 'CTO Research Deck'),
    subtitle: deck?.subtitle ? String(deck.subtitle) : undefined,
    sections,
  };
};

export const createResearchDeck = async (params: CreateResearchDeckParams): Promise<DeckOutput> => {
  const companyUrl = getCompanyUrl(params?.job || {});
  const companyDomain = stripDomain(companyUrl);

  const extensionSignals = parseExtensionSignals(String(params?.extensionTechData || ''));
  const fulSignals = await fetchFulSignals(companyUrl);
  const w3TechsSignals = companyDomain
    ? parseW3TechsSignals(await safeFetchText(`https://w3techs.com/sites/info/${companyDomain}`, 3000))
    : [];
  const jdSignals = extractTechStackFromJd(String(params?.job?.jobDescriptionText || ''));

  const mergedSignals = normalizeList([...extensionSignals, ...fulSignals, ...w3TechsSignals, ...jdSignals]);

  const sources: string[] = [];
  if (extensionSignals.length) sources.push('wappalyzer-extension');
  if (fulSignals.length) sources.push('fulio');
  if (w3TechsSignals.length) sources.push('w3techs');
  if (jdSignals.length) sources.push('job-description');
  if (!sources.length) sources.push('heuristic-fallback');

  const prompt = buildPrompt({
    company: String(params?.job?.company || 'Company'),
    title: String(params?.job?.title || 'Product Manager'),
    companyUrl,
    userPrompt: String(params?.userPrompt || ''),
    jobDescription: String(params?.job?.jobDescriptionText || ''),
    techSignals: mergedSignals,
    sources,
    priorDeck: params?.priorDeck,
  });

  const response = await AIService.callOpenAI(prompt, undefined, 0.2);
  const content = response?.choices?.[0]?.message?.content || '';
  const parsed = AIService.parseJsonContent<{ deck: any }>(content);
  const normalized = normalizeDeck(parsed?.deck || parsed);

  return {
    ...normalized,
    metadata: {
      generatedAt: new Date().toISOString(),
      provider: response?.provider || 'unknown',
      model: response?.model || null,
      sourceCoverage: sources,
      techSignals: mergedSignals,
    },
  };
};
