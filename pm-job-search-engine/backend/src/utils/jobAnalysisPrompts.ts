export const JOB_ANALYSIS_PROMPTS = {
  ATS_VMOCK_SCORE: `You are an ATS and VMock scoring expert for Product Manager roles. Provide rigorous, improvement-focused scoring.

Return JSON with these exact keys:
currentScore (0-100)
targetScore (target score, typically 85-95)
keywordDensity (0-100, focus on exact JD term frequency)
actionVerbsScore (0-100)
metricsScore (0-100, score based on quantified outcomes per bullet)
skillsAlignmentScore (0-100)
formattingScore (0-100)
gaps (array of 5-7 specific gaps: "Missing keyword X from JD", "Bullet lacks metric", etc.)
recommendations (array of 5-7 ACTIONABLE recommendations: "Add 'X methodology' to summary", "Rewrite bullet 3 to include % result, not just activity", etc.)

SCORING GUIDANCE:
- keywordDensity: % of critical JD keywords appearing in resume (target 60%+)
- actionVerbsScore: % of bullets starting with strong verbs like Scaled, Drove, Optimized, Launched (target 90%+)
- metricsScore: % of bullets containing quantified outcomes (%, $, users, scale) (target 80%+)
- skillsAlignmentScore: % of top-10 JD skills present in resume skills section (target 70%+)
- formattingScore: Consistent formatting, clear structure, proper spacing (target 85%+)

Resume:
{resume}

Job Description:
{jd}`,

  ATS_SYSTEM_DETECTION: `You are an ATS expert. Based on the job posting URL and job description, infer the likely ATS system used.

Analyze the URL structure and content for clues about:
- Greenhouse (greenhouse.io, boards.greenhouse.io)
- Workday (myworkdaysite)
- Lever (lever.co, hire.lever.co)
- iCIMS (icims.com)
- Others

Return JSON with keys:
detectedATS (string: "Greenhouse" | "Workday" | "Lever" | "iCIMS" | "Unknown")
confidence (0-100)
optimizationStrategy (array of 3-5 tactical recommendations specific to that ATS)

Job URL: {jobUrl}
Job Description: {jd}`,

  KEYWORD_DENSITY_TABLE: `You are a keyword optimization expert for PM roles in healthcare/insurance/SaaS/marketplace.
Create a keyword frequency target table based on the job description.

Focus areas:
- product management / product development / product strategy
- marketplace / platform / B2B2C
- SaaS / subscription / integration
- API / integrations / webhooks
- healthcare / insurance / compliance / HIPAA
- user engagement / retention / monetization
- cross-functional leadership

Return JSON array with structure:
[
  { keyword: "string", targetFrequency: number (1-5), importance: "critical" | "high" | "medium" }
]

Job Description:
{jd}`,

  MISSING_ATS_KEYWORDS: `You are an ATS keyword optimization specialist. Extract HIGH-VALUE missing keywords for ATS systems.

Rules:
- ONLY keywords appearing in JD but NOT in primary resume text
- Extract 15-20 keywords minimum (ATS needs density)
- Prioritize: role titles, domain terms, methodologies, technologies, compliance/regulations
- One keyword per line
- Include exact multi-word phrases from JD (e.g., "cross-functional leadership", "data-driven decision making")
- Include acronyms if in JD (HIPAA, ICHRA, B2B2C, etc.)
- Type variations: "product management", "product strategy", "product roadmap" all count as different keywords
- Order by critical importance (top = highest ATS weight)

Resume:
{resume}

Job Description:
{jd}`,

  RESUME_BULLET_REWRITES: `You are an elite resume writer specializing in ATS-optimized PM bullets with quantified impact.

REWRITE REQUIREMENTS (non-negotiable):
- EVERY bullet MUST follow: [Strong Action Verb] [What] [How/Metric/Domain] [Quantified Outcome]
- EVERY bullet MUST include 1+ metrics: %, $, users, scale, time saved, efficiency, or other measurable result
- EVERY bullet MUST mirror 2-3 exact keywords from job description
- Use domain language: healthcare, SaaS, marketplace, compliance, integration, API, etc.
- Emphasize leadership, cross-functional work, customer/user impact
- No generic language: avoid "worked on", "helped", "supported"; use "drove", "scaled", "launched", "optimized", "established"

METRICS EXTRACTION:
- Extract ANY numeric outcome from resume (employee count, revenue %, user growth, etc.)
- Infer realistic metrics where implied (e.g., platform users → likely 1M+ in healthcare)
- Budget/scale references → emphasize if available
- Timeline emphasis when relevant

For EACH role in resume:
- Senior Product Manager / Director: 5-6 rewritten bullets (strongest domain fit + scale + leadership)
- Product Manager / Mid-level: 4-5 rewritten bullets (execution + cross-functional + domain)
- Coordinator / Entry-level: 2-3 rewritten bullets (foundational + any metrics possible)

Format output as JSON with EXACTLY this structure:
{
  "roles": [
    { "title": "[Exact Role Title]", "bullets": ["bullet1 [Action Verb]...", "bullet2..."] },
    { "title": "[Exact Role Title]", "bullets": [...] }
  ]
}

Resume:
{resume}

Job Description:
{jd}`,

  MIRRORED_JD_BULLETS: `You are an ATS specialist. Generate 3 new resume bullets that CLOSELY mirror the exact wording and structure of the job description.

These bullets should:
1. Use 70%+ of the job description language
2. Reflect work the candidate likely did
3. Be in resume bullet format
4. Include metrics where job description implies them

Job Description excerpts to mirror:
{jd}`,

  RESUME_SUMMARY_OPTIONS: `You are a strategic resume writer generating 3 STRONG professional summary options for PM export.

Generate 3 different professional summary CANDIDATES (user will pick best):

1. STARTUP-FOCUSED: Emphasize speed, iteration, MVP culture, scale from 0-1, experimentation, rapid execution
   - Sentence structure: Years + domain + 1-2 specific wins with %/$ impact + philosophy
   - Include metrics: "drove X% growth" or "scaled to Y users" or "reduced Z by %"
   
2. ENTERPRISE-FOCUSED: Emphasize scale, governance, systems thinking, stakeholder management, compliance
   - Sentence structure: Years + complexity managed + compliance/governance expertise + cross-functional leadership
   - Include metrics: "managed $X budget" or "led Y-person teams" or "achieved Z% adoption"
   
3. BALANCED: Mix startup agility with enterprise discipline, best for mid-market roles
   - Sentence structure: Years + domain + speed/execution + scale/governance + quantified impact
   - Include 2-3 specific metrics from resume (users, %, $, timeline, etc.)

CRITICAL REQUIREMENTS FOR EACH SUMMARY:
- 3-4 sentences (not 5)
- EVERY summary MUST include: years of experience + domain (healthcare, SaaS, marketplace) + 1-2 quantified results
- EVERY sentence must use 2-3 exact terms from job description for keyword density
- Use strong, polished language (not notes or bullet points)
- Lead with impact: what problems solved, outcomes delivered, not just activities
- Do NOT use filler or generic language

Resume:
{resume}

Job Description:
{jd}`,

  SKILLS_SECTION: `You are a PM skills optimizer generating a RANKED, JD-MATCHED skill list for maximum ATS score.

SKILL EXTRACTION & PRIORITIZATION:
- Extract 20-28 skills total
- Rank by relevance to SPECIFIC job description (top 8-10 are critical)
- MANDATORY INCLUSION: Every PM methodology, domain term, technology, or tool mentioned explicitly in JD
  - If JD says "OKRs, Agile, and SQL": MUST include all three
  - If JD domain is healthcare/compliance: MUST include "healthcare compliance", "regulatory", "HIPAA" etc.
  - If JD mentions stakeholders/leadership: MUST include "cross-functional leadership", "stakeholder management"

CATEGORY DISTRIBUTION (in priority order):
1. PM Methodologies matching JD: OKRs, Agile, Scrum, Lean, Design Thinking, Discovery, Product Strategy, Roadmapping
2. Domain Expertise: healthcare, insurance, SaaS, B2B2C, marketplace, compliance, fintech, etc.
3. Technologies/Tools: APIs, SQL, analytics platforms, data warehousing, integrations, specific tools mentioned
4. Leadership/Soft Skills: Cross-functional collaboration, Stakeholder management, Team leadership, Communication
5. Data/Analytics: Metrics, Analytics frameworks, Product analytics, Data interpretation

RANKING RULES:
- Rank 1-5: EXACT terms from JD (these are most critical for ATS)
- Rank 6-12: Domain + methodologies matching JD context
- Rank 13-20: Supporting/peripheral skills
- NO filler: every skill must connect to resume evidence + JD
- NO abbreviations (spell out: "Object-Relational Mapping" not "ORM" unless acronym is in JD)

Output: Each skill on its own line, in ranked order, using EXACT terminology from JD whenever possible.

Job Description:
{jd}`,

  STARTUP_VS_ENTERPRISE: `You are a career strategy expert. Explain how to position a resume for startup vs enterprise contexts.

For THIS specific job, recommend which positioning to use and why.

Format as JSON:
{
  "startupMode": "explanation of 0-1 product focus, speed, experimentation",
  "enterpriseMode": "explanation of scale, compliance, systems",
  "recommendationForThisJob": "Startup | Enterprise | Balanced"
  "reasoning": "why this is the right positioning"
}

Job Description:
{jd}`,

  COMPANY_STRATEGY: `You are a strategic advisor. Research and analyze this company's product strategy.

Return JSON with keys:
overview (2-3 sentences about what the company does)
productStrategy (current product direction, roadmap themes)
businessModel (how they make money)
targetCustomers (who they serve, use cases)
competitors (2-3 main competitors)
challenges (4-6 likely product/operational challenges)
opportunities (4-6 areas where a good PM adds value)

Company Name: {companyName}
Company URL: {companyUrl}`,

  STRATEGY_POSITIONING: `You are a positioning strategist for product managers.

Based on the company strategy and job description, advise on resume positioning:

What to EMPHASIZE (experiences that align with company needs)
What to DE-EMPHASIZE (experiences that don't fit)
Specific proof points to highlight
Potential gap to explain (if any)

Company Background: {companyContext}
Job Description: {jd}
Resume: {resume}`,

  LINKEDIN_OPTIMIZATION_JOB: `You are a LinkedIn optimization expert for product managers targeting a specific role.

Generate LinkedIn profile optimization for THIS SPECIFIC JOB:

Return JSON with keys:
headline (max 240 characters, keyword-rich, showing fit for this role)
aboutSection (5-6 sentences, conversational but strategic)
topSkills (array of top 10 skills, ranked by relevance)
recruiterSearchKeywords (array of 5-7 search terms recruiters use for this role)

Target Role: {jobTitle}
Company: {companyName}
Current Resume: {resume}
Job Description: {jd}`,

  RECRUITER_SEARCH: `You are a recruiter optimization expert. Generate search queries where this candidate's profile SHOULD appear.

Return array of 5-8 specific search terms recruiters would use to find this candidate for roles like this one.

Format:
[
  "Senior Product Manager Healthcare Platform",
  "PM B2B2C Marketplace SaaS",
  ...
]

Current Title: {currentTitle}
Target Title: {jobTitle}
Company Industry: {companyContext}`,

  NETWORKING_MESSAGES_FULL: `You are an expert at strategic networking for product managers. Generate 3 different personalized outreach messages for this opportunity.

1. HIRING MANAGER MESSAGE (LinkedIn message, 500 chars max)
2. RECRUITER MESSAGE (focused on mutual benefit, 300 chars max)
3. EMPLOYEE INFORMATIONAL (current employee at company you're targeting, 250 chars max)

All should be:
- Concise and valuable
- Show research (reference company/product details)
- Clear ask or value proposition
- Professional but warm

Job Title: {jobTitle}
Company: {companyName}
YourBackground: {yourBackground}
Company Context: {companyContext}`,

  INTERVIEW_TALKING_POINTS: `You are an interview coach for product managers. Generate 3-5 specific talking point stories.

Each story should follow Problem → Action → Result format and highlight:
1. A major product launch or optimization
2. Scaling a platform or marketplace
3. Building integrations or API strategies
4. Cross-functional leadership
5. Data-driven decision making

Stories should reference:
- Quantifiable business impact
- Team leadership
- Problem-solving approach
- Strategic thinking

Resume: {resume}
Target Role: {jobTitle}
Company: {companyName}`,

  INTERVIEW_QUESTIONS: `You are an interview preparation expert for product managers. Generate 15-20 sample interview questions for THIS SPECIFIC ROLE.

Categories:
- Product Strategy (4-5 questions)
- Prioritization & Trade-offs (3-4 questions)
- Stakeholder Management (3-4 questions)
- Execution & Metrics (3-4 questions)
- Company/Domain Specific (2-3 questions)
- Behavioral (2-3 questions

Each question should be realistic for the actual role and company.

Job Description: {jd}
Company: {companyName}`,

  HIRING_MANAGER_PSYCHOLOGY: `You are an expert in hiring manager psychology and interview dynamics. 

For THIS SPECIFIC PM ROLE AND COMPANY, provide insight into:

1. What the hiring manager actually cares about (beyond job description)
2. What their interview questions really mean (subtext)
3. How to position answers to align with their priorities
4. Red flags they'll listen for
5. Green flags that indicate strong fit

Job Description: {jd}
Company Context: {companyContext}`,

  JOB_MATCH_SUMMARY: `You are a career strategist. After comprehensive analysis, summarize the fit in 5 powerful bullets.

Each bullet should explain WHY this candidate is a strong fit, based on:
1. Domain expertise alignment
2. Product thinking alignment
3. Scale/company stage alignment  
4. Specific skill match
5. Leadership approach match

Format as array of 5 concise statements (1-2 sentences each).

Resume: {resume}
Job Description: {jd}
Company Context: {companyContext}`,

  RESUME_EXPORT_SYNTHESIS: `You are an elite resume strategist. Your task: produce a COMPLETE, POLISHED, export-ready resume as structured JSON. This output will be rendered directly into Word and PDF documents — it must be a real resume, not analysis notes.

SCORE FLOOR MANDATE:
- The original resume scored {baselineAtsScore}/100 on ATS analysis.
- Your output MUST score HIGHER than {baselineAtsScore}/100.
- NEVER remove metrics, achievements, or keywords from the original resume.
- Every metric from the original (%, $, users, timelines, scale) MUST appear in your output.

PAGE LENGTH CONSTRAINT (MANDATORY):
- The final resume MUST fill exactly 2 full pages when printed — no less, no more. Use ALL available space on both pages.
- Summary: 5-6 sentences. Be specific and impactful with metrics. This should be a substantial paragraph.
- Skills: 22-26 items (not more than 26).
- Most recent 2 roles: 6-8 bullets each. Older mid-level roles: 5-6 bullets. Entry/early roles: 4-5 bullets.
- Each bullet: aim for 25-35 words (minimum 20 words, never exceed 45 words). Bullets should be detailed and substantive.
- Scope lines: 1-2 sentences, 20-30 words.
- The resume must NOT spill onto a 3rd page, but it MUST completely fill 2 pages.
- If the resume would be under 2 pages, add more detail to every bullet, make the summary longer, add more scope context, and increase bullet counts per role.
- ERR ON THE SIDE OF MORE CONTENT. It is far worse to have a resume that only fills 1-1.5 pages than one that is slightly dense on 2 pages.

INSTRUCTIONS:

1. HEADLINE (8-12 words):
   Mirror exact JD terminology (role title, seniority, domain). Format: "[Title] | [Domain Expertise] | [Key Differentiator]"

2. SUMMARY (5-6 sentences):
   - Sentence 1: Years of experience + domain mirroring JD language
   - Sentences 2-5: Achievement statements with specific metrics from the resume
   - Final sentence: Forward-looking value proposition aligned with the target role
   - Use 6+ exact terms from JD. No filler.
   - Naturally weave high-value JD keywords (e.g., "product management", "research", "marketing", "training") into summary sentences where truthful — this is a primary keyword distribution point.
   - NEVER use the em dash character (—) in the summary. Use commas, semicolons, or separate sentences instead.

3. SKILLS (preserve primary resume skills + targeted additions):
   CRITICAL SKILL PRESERVATION RULES:
   - START with ALL skills from the primary resume — these are the baseline
   - DO NOT wholesale-remove existing skills. The primary resume skills represent the candidate's real expertise
   - Only REMOVE a specific skill if a selected keyword directly replaces it (e.g., replace "Product vision" with "go-to-market campaigns" only if they overlap)
   - REWORD a skill only when the JD uses different terminology for the same concept
   - ADD missing JD keywords as NEW skills appended to the list
   - If selected keywords are provided (in missingKeywords), integrate them by:
     a) Adding them as new skills if they don't overlap with existing ones
     b) Rewording an existing skill to incorporate the keyword if they're related
     c) Only removing an existing skill if the keyword is a direct, better replacement for ATS purposes
   - Final list should be 22-26 items. Do NOT exceed 26 skills — ATS systems flag excessive skill lists as keyword stuffing.
   - Rank by JD relevance but KEEP all primary skills unless there's a specific reason to remove
   - ANTI-STUFFING: If a keyword can be naturally woven into a bullet or summary instead, prefer that over adding it as a standalone skill. Skills should be genuine capability areas, not a dumping ground for every JD term.

   Primary Resume Skills (PRESERVE THESE):
   {primarySkills}

4. EXPERIENCE (array of work entries — THIS IS THE CORE OF THE RESUME):
   For EACH role from the resume, produce a structured entry:
   - title: Exact job title from the resume
   - company: Exact company name from the resume
   - location: City, State (if available in the resume)
   - dates: Exact date range from the resume (e.g., "January 2023 – Present")
   - scope: A single sentence (15-25 words) summarizing the role's context, team, product area, and scale. Example: "Led product strategy for a healthcare SaaS platform serving 1M+ members across 400+ employer clients." This helps ATS parsers and recruiters quickly understand each role.
   - bullets: 6-8 ATS-optimized bullets for recent roles, 5-6 for older roles, 4-5 for entry roles

   KEYWORD DISTRIBUTION IN BULLETS:
   - Naturally embed high-frequency JD keywords (e.g., "product management", "research", "marketing", "training") within bullet text where truthful.
   - Example: Instead of a generic "Led discovery efforts", write "Led product management research initiatives including competitive analysis and user interviews to validate feature priorities."
   - Aim to place each target keyword in 2-3 different bullets across all roles, not just once in skills.

   BULLET REQUIREMENTS:
   - Source from bulletRewrites analysis AND original resume bullets
   - Format: [Strong Action Verb] + [What you did] + [How/Methodology] + [Quantified Result]
   - EVERY bullet MUST include 1+ metric (%, $, users, time, scale, efficiency)
   - Mirror 50%+ of language from JD requirements
   - Use verbs: Scaled, Optimized, Launched, Drove, Built, Established, Automated, Achieved
   - NEVER use "worked on", "helped", "supported"
   - Diversify metric types across bullets (growth, efficiency, cost, reliability, engagement)
   - Preserve ALL original metrics — enhance but never drop them
   - If the original resume has a Key Contributions sub-section under a role, incorporate those achievements into the bullet points

   ROLE ORDERING: Most recent first. Include ALL roles from the resume.
   - Most recent 2 roles: 6-8 bullets each (highest-impact, keyword-rich)
   - Older mid-level roles: 5-6 bullets each
   - Entry/early roles: 4-5 bullets each
   - TOTAL BULLETS across all roles should be 35-45 to fill 2 pages
   - IMPORTANT: More bullets is better than fewer. A resume that only fills 1.5 pages looks incomplete.

5. EDUCATION (array of objects):
   - Each entry: { degree, institution, year (if available) }
   - Copy exactly from the resume

6. CERTIFICATIONS (array of strings):
   - List each certification from the resume exactly as written

7. KEYWORDS ADDED (8-12 ATS terms):
   - 50% from missingKeywords analysis, 50% from JD
   - Exact terms only, not synonyms

8. ATS RECOMMENDATIONS (3-5 tactical actions):
   - Specific, actionable: "Add 'healthcare compliance' to summary"
   - Source from atsVmockScore recommendations and gaps

SYNTHESIS RULES:
1. Ground ALL claims in the source resume. NO invented metrics, employers, or dates.
2. Use the STRONGEST bulletRewrites from analysis — place them under the correct role.
3. Mirror JD keywords in every section — this is the primary ATS score driver.
4. Summary and bullets must read as polished resume copy, NOT analysis notes.
5. If a Template Resume is provided, match its formatting style (section order, bullet structure, tone).
6. Your output MUST score higher than {baselineAtsScore}/100. Add more JD keywords and metrics until it does.
7. SKILLS PRESERVATION: Do NOT replace the primary resume's skill list wholesale. Keep existing skills and make targeted additions/swaps only. The candidate's core competencies must remain.8. COMPANY ALIGNMENT: Use the Company Research below to align resume language with the company’s products, domain, and strategic priorities. Reference the company’s industry terminology, product areas, and challenges in the summary and bullet rewrites where the candidate’s experience genuinely maps. This signals domain fit to both ATS and human reviewers.
PRE-FLIGHT SELF-CHECK (do before returning JSON):
- ALL metrics from the original resume are preserved
- EVERY bullet has at least one concrete metric
- 70%+ of skills use exact JD terminology
- 80%+ of primary resume skills are preserved (only targeted removals allowed)
- Summary includes years of experience, domain, and quantified outcomes
- Every role from the original resume is included with its correct title/company/dates
- Every experience entry includes a "scope" field with a one-sentence role context summary
- Skills list is 22-26 items (NOT more than 26) — no keyword stuffing
- High-frequency JD keywords appear 2-3 times ACROSS sections (summary, bullets, scope), not just skills
- Output would score HIGHER than {baselineAtsScore}/100
- TOTAL content fills exactly 2 printed pages (summary 5-6 sentences, skills 22-26, total bullets 35-45, each bullet 25-35 words)
- Resume would NOT fit on 1 page — if it would, you need MORE content

Return valid JSON only with these exact keys:
{
  "headline": "string",
  "summary": "string",
  "skills": ["string"],
  "experience": [
    {
      "title": "Exact Job Title",
      "company": "Exact Company Name",
      "location": "City, State",
      "dates": "Start – End",
      "scope": "One-sentence role summary with context, team, product area, and scale",
      "bullets": ["bullet1", "bullet2", ...]
    }
  ],
  "education": [
    { "degree": "string", "institution": "string", "year": "string or empty" }
  ],
  "certifications": ["string"],
  "keywordsAdded": ["string"],
  "atsRecommendations": ["string"]
}

Target Role: {jobTitle}
Target Company: {companyName}

Resume:
{resume}

Job Description:
{jd}

Template Resume (match its formatting style and section ordering):
{templateResume}

Job Analysis Sections (use bulletRewrites, missingKeywords, atsVmockScore for strongest content):
{analysisSections}

Company Research (use to align resume language with this company's products, domain, and strategic priorities):
{companyResearch}`,
};

export const JOB_ANALYSIS_PROMPTS_MAP = JOB_ANALYSIS_PROMPTS;
