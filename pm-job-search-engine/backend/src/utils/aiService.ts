import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';
import { prisma } from '../index';

type AIChatResponse = {
  choices: Array<{ message: { content: string } }>;
  provider?: 'openai' | 'anthropic';
  model?: string;
};

const OPENAI_PROVIDER = 'openai';
const ANTHROPIC_PROVIDER = 'anthropic';

const getOpenAIClient = () => {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  const isPlaceholder =
    !apiKey ||
    apiKey.includes('sk-your-') ||
    apiKey.includes('your-openai-api-key') ||
    apiKey.includes('replace-me');

  if (isPlaceholder) {
    throw new Error(
      'OPENAI_API_KEY is not configured with a valid key. Update backend/.env with a real OpenAI API key.',
    );
  }

  return new OpenAI({ apiKey });
};

const getAnthropicApiKey = (): string => {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  return apiKey;
};

const hasAnthropicKey = (): boolean => Boolean(getAnthropicApiKey());

const DEFAULT_OPENAI_MODEL = (process.env.OPENAI_MODEL || 'gpt-5.4').trim();
const FALLBACK_MODELS = [
  (process.env.OPENAI_FALLBACK_MODEL || '').trim(),
  'gpt-5.4',
  'o3',
  'gpt-5.3-codex',
  'gpt-5.4-mini',
  'gpt-4o-mini',
].filter(Boolean);

const DEFAULT_ANTHROPIC_MODEL = (process.env.ANTHROPIC_MODEL || 'claude-opus-4-6').trim();

const ANTHROPIC_FALLBACK_MODELS = [
  (process.env.ANTHROPIC_FALLBACK_MODEL || '').trim(),
  'claude-opus-4-6',
  'claude-3-haiku-20240307',
].filter(Boolean);

const normalizeAnthropicModel = (model?: string): string => {
  const requested = (model || '').trim();
  if (!requested) return DEFAULT_ANTHROPIC_MODEL;
  return requested;
};

const getAnthropicModelCandidates = (model?: string): string[] => {
  const primary = normalizeAnthropicModel(model);
  return Array.from(new Set([primary, ...ANTHROPIC_FALLBACK_MODELS]));
};

const normalizeRequestedModel = (model?: string): string => {
  const requested = (model || '').trim();
  if (!requested) return DEFAULT_OPENAI_MODEL;

  // Map legacy/default picks to currently available families.
  if (requested === 'gpt-4') return 'gpt-5.4';
  if (requested === 'gpt-3.5-turbo') return 'gpt-5.4';

  return requested;
};

const getModelCandidates = (model?: string): string[] => {
  const primary = normalizeRequestedModel(model);
  return Array.from(new Set([primary, ...FALLBACK_MODELS]));
};

const isOpenAiFamilyModel = (model?: string): boolean => {
  const value = (model || '').trim().toLowerCase();
  if (!value) return false;
  return value.startsWith('gpt-') || value.startsWith('o1') || value.startsWith('o3') || value.startsWith('o4');
};

const isAnthropicFamilyModel = (model?: string): boolean => {
  const value = (model || '').trim().toLowerCase();
  if (!value) return false;
  return value.startsWith('claude-');
};

const resolveModelForProvider = (provider: string, requestedModel?: string): string => {
  if (provider === ANTHROPIC_PROVIDER) {
    if (!requestedModel || isOpenAiFamilyModel(requestedModel)) {
      return DEFAULT_ANTHROPIC_MODEL;
    }
    return requestedModel;
  }

  if (!requestedModel || isAnthropicFamilyModel(requestedModel)) {
    return DEFAULT_OPENAI_MODEL;
  }

  return requestedModel;
};

const isModelUnavailableError = (error: any): boolean => {
  const status = error?.status;
  const code = (error?.code || '').toString().toLowerCase();
  const message = (error?.message || '').toString().toLowerCase();

  return (
    status === 404 ||
    code.includes('model_not_found') ||
    message.includes('model') &&
      (message.includes('does not exist') || message.includes('do not have access'))
  );
};

const isQuotaExceededError = (error: any): boolean => {
  const status = Number(error?.status || error?.response?.status || 0);
  const code = (error?.code || error?.response?.data?.error?.type || '').toString().toLowerCase();
  const message = (
    error?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    ''
  )
    .toString()
    .toLowerCase();

  return (
    status === 429 ||
    code.includes('insufficient_quota') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    message.includes('rate limit')
  );
};

const toChatResponse = (content: string): AIChatResponse => ({
  choices: [{ message: { content } }],
});

const isAnthropicRateLimitError = (error: any): boolean => {
  const status = Number(error?.response?.status || error?.status || 0);
  const errorType = (error?.response?.data?.error?.type || '').toString().toLowerCase();
  return status === 429 || status === 529 || errorType.includes('rate_limit') || errorType.includes('overloaded');
};

const callAnthropic = async (
  prompt: string,
  model?: string,
  temperature: number = 0.7,
): Promise<AIChatResponse> => {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  let lastError: any;
  const candidates = getAnthropicModelCandidates(model);
  const MAX_RETRIES = 3;

  for (const candidate of candidates) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: candidate,
            max_tokens: 16384,
            temperature,
            messages: [{ role: 'user', content: prompt }],
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            timeout: 180_000,
          },
        );

        const blocks = Array.isArray(response?.data?.content) ? response.data.content : [];
        const text = blocks
          .filter((block: any) => block?.type === 'text' && typeof block?.text === 'string')
          .map((block: any) => block.text)
          .join('\n')
          .trim();

        if (!text) {
          throw new Error('Anthropic response did not include text content');
        }

        return {
          ...toChatResponse(text),
          provider: 'anthropic',
          model: candidate,
        };
      } catch (error: any) {
        lastError = error;
        const status = Number(error?.response?.status || error?.status || 0);
        const errorType = (error?.response?.data?.error?.type || '').toString().toLowerCase();
        const errorMsg = error?.response?.data?.error?.message || error?.message || '';

        // Rate limit / overloaded → retry with exponential backoff
        if (isAnthropicRateLimitError(error) && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15000);
          console.warn(`Anthropic rate limited (${status}): ${errorMsg}. Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // Model not found → try next model candidate
        if (status === 404 || errorType.includes('not_found') || errorType.includes('invalid_request_error')) {
          console.warn(`Anthropic model unavailable: ${candidate}. Trying next fallback model.`);
          break; // break inner retry loop, continue to next candidate
        }

        // Log the actual error for diagnostics before throwing
        console.error(`Anthropic call failed [${candidate}] (${status}): ${errorMsg}`);
        throw error;
      }
    }
  }

  throw lastError || new Error('Anthropic request failed for all configured models');
};

// ============== AI PROMPTS ==============

const PROMPTS = {
  KEYWORD_EXTRACTION: `You are an ATS keyword extraction expert. Analyze the following job description and extract:
1. Critical keywords (3-5 most important)
2. Soft skills required
3. Technical skills
4. Years of experience mentioned
5. Education requirements

Return as JSON with these exact keys: criticalKeywords, softSkills, technicalSkills, yearsExperience, educationRequired.

Job Description:
{jd}`,

  RESUME_TAILOR: `You are an expert resume writer focused on ATS optimization and tailoring. Analyze the resume and job description, then provide:
1. Missing keywords to add
2. 5 bullet point rewrites that mirror the job description language
3. Professional summary rewrite (2-3 sentences)
4. Skills section optimization
5. ATS optimization recommendations

Return as JSON with keys: missingKeywords, bulletRewrites, summaryRewrite, skillsOptimization, atsRecommendations.

Resume:
{resume}

Job Description:
{jd}`,

  COMPANY_RESEARCH: `You are a strategic researcher. Based on the company name and any provided information, create a comprehensive research briefing with:
1. Company Overview (2-3 sentences)
2. Business Model (how they make money)
3. Product Strategy (current products/direction)
4. Target Customers (who they serve)
5. Key Competitors (2-3 main competitors)
6. Strategic Challenges (what they struggle with)
7. Strategic Opportunities (where they're headed)
8. Potential Interview Topics (what to prepare for)

Return as JSON with these keys: overview, businessModel, productStrategy, targetCustomers, competitors, challenges, opportunities, interviewTopics.

Company: {company}
Additional info: {info}`,

  INTERVIEW_PREP: `You are an interview coach for product manager interviews. Generate a comprehensive interview preparation package:
1. 15 behavioral questions (with suggested approaches)
2. 10 product thinking questions
3. 5 company/strategy specific questions (based on provided company)
4. Mock interview tips specific to this company
5. Story bank suggestions based on the resume

Return as JSON with keys: behavioralQuestions, productQuestions, companyQuestions, mockTips, storyBank.

Company: {company}
Role: {role}
Resume highlights: {resume}`,

  NETWORKING_MESSAGE: `You are an expert at writing professional networking messages. Generate personalized outreach messages:
1. Short version (140 characters - for Slack/DM)
2. Medium version (280 characters - for LinkedIn comment)
3. Long version (full LinkedIn message)

All versions should:
- Show specific knowledge about the recipient or company
- Reference something interesting about the company or role
- Include a clear, low-friction ask

Return as JSON with keys: shortMessage, mediumMessage, longMessage.

Context:
- Recipient: {recipientName} ({recipientRole})
- Company: {company}
- Role: {role}
- Your Background: {background}`,

  ATS_SCORE: `You are an ATS scoring expert. Score the provided resume against the job description on these criteria (0-100 for each):
1. Keyword Match (% match of critical keywords)
2. Experience Level (years match)
3. Skill Alignment (technical skills match)
4. Format Compliance (ATS-friendly formatting)
5. Overall ATS Score (weighted average)

Also provide:
- Top gaps
- Quick wins for improvement
- Recommendations

Return as JSON with keys: keywordMatch, experienceLevel, skillAlignment, formatCompliance, overallScore, topGaps, quickWins, recommendations.

Resume:
{resume}

Job Description:
{jd}`,

  LINKEDIN_OPTIMIZER: `You are a LinkedIn optimization expert. Based on the user's profile info and target roles, create optimized LinkedIn content:
1. Professional Headline (120 characters max)
2. About Section (2-3 paragraphs, engaging and keyword-rich)
3. Top 5 Skills to highlight
4. Recruiter search optimization keywords
5. Content pillar suggestions (what to post about)

Return as JSON with keys: headline, about, topSkills, recruiterKeywords, contentPillars.

Current Role: {role}
Target Roles: {targetRoles}
Background: {background}
Top Skills: {skills}`,

  LINKEDIN_MESSAGE_TEMPLATES: `Generate 3 different LinkedIn outreach message templates for different scenarios:
1. Cold outreach to recruiter
2. Warm introduction through mutual connection
3. Following up on application

Each should be professional, concise, and include clear next steps.

Return as JSON as array with keys: scenario, message, characterCount.`
,

  PROFILE_FROM_SOURCES: `You are a professional branding writer for product management candidates.
Create profile text using both resume details and LinkedIn profile page content.

Rules:
1. Headline must be under 120 characters.
2. Bio should be 2 concise paragraphs and under 700 characters total.
3. Focus on PM outcomes, domain strengths, leadership, and measurable impact.
4. Avoid placeholders and avoid hallucinating exact metrics not present in input.

Return JSON with keys: headline, bio.

Resume Source:
{resumeSource}

LinkedIn Source:
{linkedinSource}`
};

// ============== SERVICES ==============

export class AIService {
  static parseJsonContent<T>(content: string): T {
    const trimmed = (content || '').trim();

    try {
      return JSON.parse(trimmed) as T;
    } catch {
      // Continue with extraction fallbacks.
    }

    const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeFenceMatch?.[1]) {
      return JSON.parse(codeFenceMatch[1].trim()) as T;
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      return JSON.parse(objectMatch[0]) as T;
    }

    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch?.[0]) {
      return JSON.parse(arrayMatch[0]) as T;
    }

    throw new Error('Model response did not contain valid JSON content');
  }

  /**
   * Call OpenAI with streaming or standard response
   */
  static async callOpenAI(
    prompt: string,
    model: string = DEFAULT_OPENAI_MODEL,
    temperature: number = 0.7,
    stream: boolean = false,
  ): Promise<AIChatResponse> {
    const preferredProvider = (process.env.AI_PROVIDER || ANTHROPIC_PROVIDER).trim().toLowerCase();
    const providerModel = resolveModelForProvider(preferredProvider, model);

    const attemptOpenAI = async (): Promise<AIChatResponse> => {
      const client = getOpenAIClient();
      const candidates = getModelCandidates(providerModel);
      let lastError: any;

      for (const candidate of candidates) {
        try {
          const response = await client.chat.completions.create({
            model: candidate,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            stream: false,
          });

          return {
            ...(response as unknown as AIChatResponse),
            provider: 'openai',
            model: candidate,
          };
        } catch (error: any) {
          lastError = error;
          if (isModelUnavailableError(error)) {
            console.warn(`OpenAI model unavailable: ${candidate}. Trying next fallback model.`);
            continue;
          }
          throw error;
        }
      }

      throw lastError || new Error('OpenAI request failed for all configured models');
    };

    const attemptAnthropic = async (): Promise<AIChatResponse> => {
      return callAnthropic(prompt, providerModel, temperature);
    };

    if (preferredProvider === ANTHROPIC_PROVIDER) {
      if (!hasAnthropicKey()) {
        // Anthropic preferred but no key — fall back to OpenAI if available
        if (!process.env.OPENAI_API_KEY) {
          throw new Error(
            'No AI provider is configured. Set ANTHROPIC_API_KEY in backend/.env to use Claude, or ensure OPENAI_API_KEY is set.'
          );
        }
        console.warn('AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. Falling back to OpenAI.');
        try {
          return await attemptOpenAI();
        } catch (openAiError: any) {
          if (isQuotaExceededError(openAiError)) {
            throw new Error(
              'OpenAI quota exceeded and ANTHROPIC_API_KEY is not configured. ' +
              'Add your Anthropic API key to backend/.env (ANTHROPIC_API_KEY=sk-ant-...) to enable Claude as an AI provider.'
            );
          }
          throw openAiError;
        }
      }

      try {
        return await attemptAnthropic();
      } catch (anthropicError: any) {
        if (!process.env.OPENAI_API_KEY) {
          throw anthropicError;
        }
        const anthropicMsg = anthropicError?.response?.data?.error?.message || anthropicError?.message || String(anthropicError);
        console.error(`[callOpenAI] Anthropic failed: ${anthropicMsg}`);
        console.warn('Anthropic request failed, falling back to OpenAI.', anthropicMsg);
        try {
          return await attemptOpenAI();
        } catch (openAiError: any) {
          if (isQuotaExceededError(openAiError)) {
            throw new Error(
              `Both AI providers failed: Anthropic error (${anthropicMsg}) and OpenAI quota exceeded. ` +
              'Check your ANTHROPIC_API_KEY in backend/.env or restore OpenAI quota.'
            );
          }
          throw openAiError;
        }
      }
    }

    try {
      return await attemptOpenAI();
    } catch (openAiError: any) {
      if (isQuotaExceededError(openAiError)) {
        if (hasAnthropicKey()) {
          console.warn('OpenAI quota/rate issue detected. Falling back to Anthropic Claude.');
          return attemptAnthropic();
        }
        throw new Error(
          'OpenAI quota exceeded. Add ANTHROPIC_API_KEY to backend/.env to enable Claude as a fallback provider.'
        );
      }

      throw openAiError;
    }
  }

  /**
   * Extract keywords from job description
   */
  static async extractKeywords(jobDescription: string) {
    const prompt = PROMPTS.KEYWORD_EXTRACTION.replace('{jd}', jobDescription);
    const response = await this.callOpenAI(prompt);
    
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  /**
   * Tailor resume for job
   */
  static async tailorResume(
    resume: string,
    jobDescription: string,
    templateResume: string = '',
  ) {
    const templateContext = templateResume
      ? `\n\nTemplate Resume (use this for formatting structure, section ordering, and style guidance):\n${templateResume}`
      : '';
    const prompt = PROMPTS.RESUME_TAILOR
      .replace('{resume}', resume)
      .replace('{jd}', jobDescription + templateContext);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return {
      data: this.parseJsonContent<any>(content),
      provider: response.provider || 'openai',
      model: response.model || null,
    };
  }

  /**
   * Synthesize final export-ready resume content using the job-analysis prompt library.
   */
  static async synthesizeResumeExport(
    resume: string,
    jobDescription: string,
    analysisData: any,
    jobTitle: string,
    companyName: string,
    templateResume: string = '',
    baselineAtsScore: number = 0,
    selectedKeywords: string[] = [],
    primarySkills: string[] = [],
    detectedAtsSystem: string = 'Unknown',
  ) {
    const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
    const { getAtsPromptAddendum } = await import('./atsRulesDatabase');
    // Only include synthesis-relevant sections to keep prompt size manageable
    const sections = analysisData?.sections || {};
    const synthesisRelevantSections = {
      atsVmockScore: sections.atsVmockScore || null,
      bulletRewrites: sections.bulletRewrites || null,
      missingKeywords: selectedKeywords.length > 0
        ? selectedKeywords.join('\n')
        : (sections.missingKeywords || null),
      skillsSection: sections.skillsSection || null,
      summaryOptions: sections.summaryOptions || null,
      jobMatchSummary: sections.jobMatchSummary || null,
      atsSystemDetection: sections.atsSystemDetection || null,
      keywordDensityTable: sections.keywordDensityTable || null,
    };
    const analysisSections = JSON.stringify(synthesisRelevantSections, null, 2);

    // Build company research context from analysis
    const companyStrategy = sections.companyStrategy || null;
    const strategyPositioning = sections.strategyPositioning || null;
    const companyResearchParts: string[] = [];
    if (companyStrategy) {
      if (typeof companyStrategy === 'string') {
        companyResearchParts.push(companyStrategy);
      } else {
        if (companyStrategy.overview) companyResearchParts.push(`Overview: ${companyStrategy.overview}`);
        if (companyStrategy.productStrategy) companyResearchParts.push(`Product Strategy: ${companyStrategy.productStrategy}`);
        if (companyStrategy.businessModel) companyResearchParts.push(`Business Model: ${companyStrategy.businessModel}`);
        if (companyStrategy.targetCustomers) companyResearchParts.push(`Target Customers: ${companyStrategy.targetCustomers}`);
        if (companyStrategy.competitors) companyResearchParts.push(`Competitors: ${Array.isArray(companyStrategy.competitors) ? companyStrategy.competitors.join(', ') : companyStrategy.competitors}`);
        if (companyStrategy.challenges) companyResearchParts.push(`Challenges: ${Array.isArray(companyStrategy.challenges) ? companyStrategy.challenges.join('; ') : companyStrategy.challenges}`);
        if (companyStrategy.opportunities) companyResearchParts.push(`Opportunities: ${Array.isArray(companyStrategy.opportunities) ? companyStrategy.opportunities.join('; ') : companyStrategy.opportunities}`);
      }
    }
    if (strategyPositioning && typeof strategyPositioning === 'string') {
      companyResearchParts.push(`Positioning Advice: ${strategyPositioning}`);
    } else if (strategyPositioning && typeof strategyPositioning === 'object') {
      if (strategyPositioning.recommendationForThisJob) companyResearchParts.push(`Recommended Positioning: ${strategyPositioning.recommendationForThisJob}`);
      if (strategyPositioning.reasoning) companyResearchParts.push(`Reasoning: ${strategyPositioning.reasoning}`);
    }
    const companyResearchContext = companyResearchParts.length > 0
      ? companyResearchParts.join('\n')
      : 'No company research available.';
    const scoreLabel = baselineAtsScore > 0 ? String(baselineAtsScore) : 'unknown';
    const primarySkillsLabel = primarySkills.length > 0
      ? primarySkills.map(s => `- ${s}`).join('\n')
      : 'Not available — use skills from the resume text above.';
    const atsAddendum = getAtsPromptAddendum(detectedAtsSystem);
    const prompt = JOB_ANALYSIS_PROMPTS.RESUME_EXPORT_SYNTHESIS
      .replace('{jobTitle}', jobTitle)
      .replace('{companyName}', companyName)
      .replace('{resume}', resume)
      .replace('{jd}', jobDescription)
      .replace('{templateResume}', templateResume || 'No template resume provided.')
      .replace('{analysisSections}', analysisSections)
      .replace('{primarySkills}', primarySkillsLabel)
      .replace('{companyResearch}', companyResearchContext)
      .replace(/\{baselineAtsScore\}/g, scoreLabel)
      + '\n\n' + atsAddendum;

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return {
      data: this.parseJsonContent<any>(content),
      provider: response.provider || 'openai',
      model: response.model || null,
    };
  }

  /**
   * Research company
   */
  static async researchCompany(
    companyName: string,
    additionalInfo: string = '',
  ) {
    const prompt = PROMPTS.COMPANY_RESEARCH
      .replace('{company}', companyName)
      .replace('{info}', additionalInfo);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  /**
   * Generate interview prep materials
   */
  static async generateInterviewPrep(
    company: string,
    role: string,
    resumeHighlights: string,
  ) {
    const prompt = PROMPTS.INTERVIEW_PREP
      .replace('{company}', company)
      .replace('{role}', role)
      .replace('{resume}', resumeHighlights);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  /**
   * Generate networking message
   */
  static async generateNetworkingMessage(
    recipientName: string,
    recipientRole: string,
    company: string,
    jobRole: string,
    userBackground: string,
  ) {
    const prompt = PROMPTS.NETWORKING_MESSAGE
      .replace('{recipientName}', recipientName)
      .replace('{recipientRole}', recipientRole)
      .replace('{company}', company)
      .replace('{role}', jobRole)
      .replace('{background}', userBackground);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  /**
   * Score resume against job (ATS simulation)
   */
  static async scoreResume(
    resume: string,
    jobDescription: string,
  ) {
    const prompt = PROMPTS.ATS_SCORE
      .replace('{resume}', resume)
      .replace('{jd}', jobDescription);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  /**
   * Optimize LinkedIn profile
   */
  static async optimizeLinkedIn(
    role: string,
    targetRoles: string,
    background: string,
    skills: string,
  ) {
    const prompt = PROMPTS.LINKEDIN_OPTIMIZER
      .replace('{role}', role)
      .replace('{targetRoles}', targetRoles)
      .replace('{background}', background)
      .replace('{skills}', skills);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  /**
   * Generate profile headline and bio from resume + LinkedIn sources
   */
  static async generateProfileFromSources(
    resumeSource: string,
    linkedinSource: string,
  ) {
    const prompt = PROMPTS.PROFILE_FROM_SOURCES
      .replace('{resumeSource}', resumeSource)
      .replace('{linkedinSource}', linkedinSource);

    const response = await this.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return this.parseJsonContent<any>(content);
  }

  // ============== COMPREHENSIVE JOB ANALYSIS (20 SECTIONS) ==============

  /**
   * Generate ATS and VMock scoring analysis
   */
  private static async analyzeATSScore(resume: string, jobDescription: string) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.ATS_VMOCK_SCORE
        .replace('{resume}', resume)
        .replace('{jd}', jobDescription);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error analyzing ATS score:', error);
      return {
        error: 'Failed to analyze ATS score',
        currentScore: 0,
        gaps: [],
      };
    }
  }

  /**
   * Detect ATS system from job URL and description
   */
  private static async detectATSSystem(jobUrl: string, jobDescription: string) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.ATS_SYSTEM_DETECTION
        .replace('{jobUrl}', jobUrl)
        .replace('{jd}', jobDescription);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error detecting ATS system:', error);
      return { detectedATS: 'Unknown', confidence: 0, optimizationStrategy: [] };
    }
  }

  /**
   * Generate keyword density targets
   */
  private static async generateKeywordTargets(jobDescription: string) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.KEYWORD_DENSITY_TABLE.replace(
        '{jd}',
        jobDescription,
      );

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error generating keyword targets:', error);
      return [];
    }
  }

  /**
   * Identify missing ATS keywords
   */
  private static async identifyMissingKeywords(
    resume: string,
    jobDescription: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.MISSING_ATS_KEYWORDS
        .replace('{resume}', resume)
        .replace('{jd}', jobDescription);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as plain text for easy copy-paste
    } catch (error) {
      console.error('Error identifying missing keywords:', error);
      return '';
    }
  }

  /**
   * Generate resume bullet rewrites
   */
  private static async rewriteResumeBullets(
    resume: string,
    jobDescription: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.RESUME_BULLET_REWRITES
        .replace('{resume}', resume)
        .replace('{jd}', jobDescription);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error rewriting resume bullets:', error);
      return { roles: [] };
    }
  }

  /**
   * Generate JD-mirrored bullets
   */
  private static async generateMirroredBullets(jobDescription: string) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.MIRRORED_JD_BULLETS.replace(
        '{jd}',
        jobDescription,
      );

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as plain text
    } catch (error) {
      console.error('Error generating mirrored bullets:', error);
      return '';
    }
  }

  /**
   * Generate resume summary options (startup vs enterprise)
   */
  private static async generateSummaryOptions(
    resume: string,
    jobDescription: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.RESUME_SUMMARY_OPTIONS
        .replace('{resume}', resume)
        .replace('{jd}', jobDescription);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as text with all 3 options
    } catch (error) {
      console.error('Error generating summary options:', error);
      return '';
    }
  }

  /**
   * Optimize skills section
   */
  private static async optimizeSkillsSection(jobDescription: string) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.SKILLS_SECTION.replace(
        '{jd}',
        jobDescription,
      );

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as line-separated text
    } catch (error) {
      console.error('Error optimizing skills section:', error);
      return '';
    }
  }

  /**
   * Analyze startup vs enterprise positioning
   */
  private static async analyzeCompanyPositioning(jobDescription: string) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.STARTUP_VS_ENTERPRISE.replace(
        '{jd}',
        jobDescription,
      );

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error analyzing positioning:', error);
      return {
        startupMode: '',
        enterpriseMode: '',
        recommendationForThisJob: '',
      };
    }
  }

  /**
   * Research company strategy
   */
  private static async analyzeCompanyStrategy(
    companyName: string,
    companyUrl: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.COMPANY_STRATEGY
        .replace('{companyName}', companyName)
        .replace('{companyUrl}', companyUrl);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error analyzing company strategy:', error);
      return {
        overview: '',
        productStrategy: '',
        businessModel: '',
        targetCustomers: '',
        competitors: [],
        challenges: [],
        opportunities: [],
      };
    }
  }

  /**
   * Generate strategic resume positioning advice
   */
  private static async generateStrategyPositioning(
    companyContext: string,
    jobDescription: string,
    resume: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.STRATEGY_POSITIONING
        .replace('{companyContext}', companyContext)
        .replace('{jd}', jobDescription)
        .replace('{resume}', resume);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as formatted text
    } catch (error) {
      console.error('Error generating positioning strategy:', error);
      return '';
    }
  }

  /**
   * Generate LinkedIn optimization for specific job
   */
  private static async optimizeLinkedInForJob(
    jobTitle: string,
    companyName: string,
    resume: string,
    jobDescription: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.LINKEDIN_OPTIMIZATION_JOB
        .replace('{jobTitle}', jobTitle)
        .replace('{companyName}', companyName)
        .replace('{resume}', resume)
        .replace('{jd}', jobDescription);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error optimizing LinkedIn:', error);
      return {
        headline: '',
        aboutSection: '',
        topSkills: [],
        recruiterSearchKeywords: [],
      };
    }
  }

  /**
   * Generate recruiter search optimization keywords
   */
  private static async generateRecruiterSearchKeywords(
    currentTitle: string,
    jobTitle: string,
    companyContext: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.RECRUITER_SEARCH
        .replace('{currentTitle}', currentTitle)
        .replace('{jobTitle}', jobTitle)
        .replace('{companyContext}', companyContext);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error generating recruiter search keywords:', error);
      return [];
    }
  }

  /**
   * Generate networking messages for this opportunity
   */
  private static async generateNetworkingMessagesForJob(
    jobTitle: string,
    companyName: string,
    yourBackground: string,
    companyContext: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.NETWORKING_MESSAGES_FULL
        .replace('{jobTitle}', jobTitle)
        .replace('{companyName}', companyName)
        .replace('{yourBackground}', yourBackground)
        .replace('{companyContext}', companyContext);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as formatted text
    } catch (error) {
      console.error('Error generating networking messages:', error);
      return '';
    }
  }

  /**
   * Generate interview talking points and stories
   */
  private static async generateInterviewTalkingPoints(
    resume: string,
    jobTitle: string,
    companyName: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.INTERVIEW_TALKING_POINTS
        .replace('{resume}', resume)
        .replace('{jobTitle}', jobTitle)
        .replace('{companyName}', companyName);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as formatted text
    } catch (error) {
      console.error('Error generating interview talking points:', error);
      return '';
    }
  }

  /**
   * Generate mock interview questions for this role
   */
  private static async generateInterviewQuestions(
    jobDescription: string,
    companyName: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.INTERVIEW_QUESTIONS
        .replace('{jd}', jobDescription)
        .replace('{companyName}', companyName);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as numbered list
    } catch (error) {
      console.error('Error generating interview questions:', error);
      return '';
    }
  }

  /**
   * Generate insights into hiring manager psychology
   */
  private static async analyzeHiringManagerPsychology(
    jobDescription: string,
    companyContext: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.HIRING_MANAGER_PSYCHOLOGY
        .replace('{jd}', jobDescription)
        .replace('{companyContext}', companyContext);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return content; // Returns as formatted text
    } catch (error) {
      console.error('Error analyzing hiring manager psychology:', error);
      return '';
    }
  }

  /**
   * Generate final job match summary bullets
   */
  private static async generateJobMatchSummary(
    resume: string,
    jobDescription: string,
    companyContext: string,
  ) {
    try {
      const { JOB_ANALYSIS_PROMPTS } = await import('./jobAnalysisPrompts');
      const prompt = JOB_ANALYSIS_PROMPTS.JOB_MATCH_SUMMARY
        .replace('{resume}', resume)
        .replace('{jd}', jobDescription)
        .replace('{companyContext}', companyContext);

      const response = await this.callOpenAI(prompt);
      const content = (response.choices[0].message as any).content;
      return this.parseJsonContent<any>(content);
    } catch (error) {
      console.error('Error generating job match summary:', error);
      return [];
    }
  }

  /**
   * MASTER FUNCTION: Generate comprehensive 20-section job analysis
   */
  static async comprehensiveJobAnalysis(
    jobId: string,
    jobTitle: string,
    companyName: string,
    companyUrl: string,
    jobDescription: string,
    jobUrl: string,
    resume: string,
    linkedinUrl?: string,
    templateResume?: string,
  ) {
    try {
      console.log(`Starting comprehensive job analysis for job: ${jobId}`);

      // Helper to run tasks in batches to avoid Anthropic rate limits
      const runBatched = async <T>(tasks: (() => Promise<T>)[], batchSize: number = 8): Promise<T[]> => {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
          const batch = tasks.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map((fn) => fn()));
          results.push(...batchResults);
          // Small delay between batches to avoid rate limits
          if (i + batchSize < tasks.length) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
        return results;
      };

      // Build a resume-with-template context for analyses that benefit from template awareness
      const resumeWithTemplate = templateResume
        ? `${resume}\n\n--- TEMPLATE RESUME (use for formatting structure, section ordering, and style) ---\n${templateResume}`
        : resume;

      // Run analyses in throttled batches to avoid Anthropic rate limits
      const [
        atsScore,
        atsSystem,
        keywordTargets,
        missingKeywords,
        bulletRewrites,
        mirroredBullets,
        summaryOptions,
        skillsSection,
        positioningAnalysis,
        companyStrategy,
        strategyPositioning,
        linkedinOptimization,
        recruiterKeywords,
        networkingMessages,
        interviewTalkingPoints,
        interviewQuestions,
        hiringManagerPsychology,
        jobMatchSummary,
      ] = await runBatched([
        () => this.analyzeATSScore(resumeWithTemplate, jobDescription),
        () => this.detectATSSystem(jobUrl, jobDescription),
        () => this.generateKeywordTargets(jobDescription),
        () => this.identifyMissingKeywords(resumeWithTemplate, jobDescription),
        () => this.rewriteResumeBullets(resumeWithTemplate, jobDescription),
        () => this.generateMirroredBullets(jobDescription),
        () => this.generateSummaryOptions(resumeWithTemplate, jobDescription),
        () => this.optimizeSkillsSection(jobDescription),
        () => this.analyzeCompanyPositioning(jobDescription),
        () => this.analyzeCompanyStrategy(companyName, companyUrl),
        () => this.generateStrategyPositioning(companyName, jobDescription, resumeWithTemplate),
        () => this.optimizeLinkedInForJob(jobTitle, companyName, resumeWithTemplate, jobDescription),
        () => this.generateRecruiterSearchKeywords(
          'Product Manager',
          jobTitle,
          companyName,
        ),
        () => this.generateNetworkingMessagesForJob(
          jobTitle,
          companyName,
          'Experienced PM',
          companyName,
        ),
        () => this.generateInterviewTalkingPoints(resumeWithTemplate, jobTitle, companyName),
        () => this.generateInterviewQuestions(jobDescription, companyName),
        () => this.analyzeHiringManagerPsychology(jobDescription, companyName),
        () => this.generateJobMatchSummary(resumeWithTemplate, jobDescription, companyName),
      ]);

      // Build comprehensive analysis object
      const analysis = {
        jobId,
        jobTitle,
        companyName,
        generatedAt: new Date(),
        sections: {
          // 1: ATS & VMock Scoring
          atsVmockScore: atsScore,

          // 2: ATS System Detection
          atsSystemDetection: atsSystem,

          // 3: Keyword Density Targets
          keywordDensityTargets: keywordTargets,

          // 4: Missing ATS Keywords
          missingKeywords,

          // 5: Resume Bullet Rewrites
          bulletRewrites,

          // 6: Mirrored JD Bullets
          mirroredBullets,

          // 7: Resume Summary Options
          summaryOptions,

          // 8: Skills Section
          skillsSection,

          // 9: Startup vs Enterprise Positioning
          companyPositioning: positioningAnalysis,

          // 10-12: Company Research & Strategy
          companyStrategy,

          // 13: Strategy & Positioning
          strategyPositioning,

          // 14: LinkedIn Optimization
          linkedinOptimization,

          // 15: Recruiter Search Optimization
          recruiterSearchKeywords: recruiterKeywords,

          // 16: Networking Messages
          networkingMessages,

          // 17: Interview Talking Points
          interviewTalkingPoints,

          // 18: Interview Questions
          interviewQuestions,

          // 19: Hiring Manager Psychology
          hiringManagerPsychology,

          // 20: Final Job Match Summary
          jobMatchSummary,
        },
      };

      const sections = analysis.sections;
      const hasMeaningfulContent = [
        sections.missingKeywords,
        sections.mirroredBullets,
        sections.summaryOptions,
        sections.skillsSection,
        sections.strategyPositioning,
        sections.networkingMessages,
        sections.interviewTalkingPoints,
        sections.interviewQuestions,
      ].some((value) => {
        if (typeof value === 'string' && value.trim().length > 0) return true;
        if (Array.isArray(value) && value.length > 0) return true;
        if (value && typeof value === 'object' && Object.keys(value).length > 0) return true;
        return false;
      });

      const usedFallbackContent = !hasMeaningfulContent;

      if (usedFallbackContent) {
        console.error('[comprehensiveJobAnalysis] All AI sections returned empty — all provider calls likely failed. Throwing instead of using fallback data.');
        throw new Error(
          'AI analysis failed: none of the AI provider calls returned content. ' +
          'Check AI_PROVIDER, ANTHROPIC_API_KEY, and ANTHROPIC_MODEL in backend/.env, then restart the backend.',
        );
      }

      (analysis as any).meta = {
        generatedWithAiPrompts: true,
        usedFallbackContent: false,
      };

      return analysis;
    } catch (error) {
      console.error('Comprehensive job analysis error:', error);
      throw error;
    }
  }
}

// ============== WEB SEARCH SERVICE ==============

export class WebSearchService {
  /**
   * Search using Serper API
   */
  static async searchSerper(query: string) {
    try {
      const response = await axios.post(
        'https://google.serper.dev/search',
        { q: query },
        {
          headers: {
            'X-API-KEY': process.env.SERPER_API_KEY,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Serper API Error:', error);
      throw error;
    }
  }

  /**
   * Search using Tavily API for research
   */
  static async searchTavily(query: string, includeImages: boolean = false) {
    try {
      const response = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: process.env.TAVILY_API_KEY,
          query,
          include_images: includeImages,
          max_results: 10,
        },
      );

      return response.data;
    } catch (error) {
      console.error('Tavily API Error:', error);
      throw error;
    }
  }

  /**
   * Get company info
   */
  static async getCompanyInfo(companyName: string) {
    const searchResults = await this.searchSerper(`${companyName} company info`);
    return searchResults;
  }

  /**
   * Get job market insights
   */
  static async getJobMarketInsights(jobTitle: string, location: string) {
    const query = `${jobTitle} jobs market salary trends ${location}`;
    const results = await this.searchSerper(query);
    return results;
  }
}

// ============== RESUME PARSING ==============

export class ResumeParsingService {
  /**
   * Parse resume text and extract structured data
   */
  static async parseResume(resumeText: string) {
    const prompt = `Extract structured information from this resume. Return JSON with keys:
    - name
    - email
    - phone
    - experience (array of {company, title, duration, description})
    - skills (array)
    - education (array of {school, degree, field, year})
    - summary

    Resume:
    ${resumeText}`;

    const response = await AIService.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return AIService.parseJsonContent<any>(content);
  }

  /**
   * Extract specific keywords from resume
   */
  static async extractSkills(resumeText: string) {
    const prompt = `Extract all technical and soft skills from this resume as a JSON array. 
    Only return the array, no other text.

    Resume:
    ${resumeText}`;

    const response = await AIService.callOpenAI(prompt);
    const content = (response.choices[0].message as any).content;
    return AIService.parseJsonContent<any>(content);
  }
}

export const PROMPTS_MAP = PROMPTS;
