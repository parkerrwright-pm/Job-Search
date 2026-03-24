# API Documentation

## Base URL

```
Development: http://localhost:5000
Production: https://api.pmjobsearch.com
```

## Authentication

All endpoints require JWT token in Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### Authentication Endpoints

#### Sign Up
```
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}

Response:
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response:
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Job Endpoints

#### List Jobs
```
GET /api/jobs?stage=APPLIED&priority=HIGH&company=Google&search=Product

Query Parameters:
- stage: SAVED, APPLIED, RECRUITER_SCREEN, HIRING_MANAGER, PANEL, FINAL, OFFER, REJECTED
- priority: HIGH, MEDIUM, LOW
- company: Filter by company name
- search: Search title, company, notes

Response:
[
  {
    "id": "job_456",
    "title": "Senior Product Manager",
    "company": "Google",
    "location": "Mountain View, CA",
    "stage": "APPLIED",
    "salary": "$200k-250k",
    "recruiter": "Sarah Chen",
    "appliedAt": "2024-01-15T10:00:00Z",
    "followUpDate": "2024-01-25T10:00:00Z",
    "notes": "Strong fit - AI/ML focus",
    "priority": "HIGH",
    "tags": ["FAANG", "AI", "PM"],
    "createdAt": "2024-01-15T08:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
]
```

#### Create Job
```
POST /api/jobs
Content-Type: application/json

{
  "title": "Product Manager - AI",
  "company": "OpenAI",
  "location": "San Francisco, CA",
  "jobUrl": "https://openai.com/careers/product-manager",
  "jobDescription": "We're looking for...",
  "salary": "$180k-220k",
  "stage": "SAVED",
  "priority": "HIGH"
}

Response:
{
  "id": "job_789",
  ...
}
```

#### Update Job Stage (Kanban)
```
PUT /api/jobs/job_456/stage
Content-Type: application/json

{
  "stage": "RECRUITER_SCREEN"
}

Response:
{
  "id": "job_456",
  "stage": "RECRUITER_SCREEN",
  ...
}
```

#### Get Job Timeline
```
GET /api/jobs/job_456/timeline

Response:
[
  {
    "id": "timeline_1",
    "jobId": "job_456",
    "event": "Job saved",
    "stage": "SAVED",
    "createdAt": "2024-01-15T08:00:00Z"
  },
  {
    "id": "timeline_2",
    "event": "Application submitted",
    "stage": "APPLIED",
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

---

### AI Endpoints

#### Analyze Job (Extract Keywords)
```
POST /api/ai/analyze-job
Content-Type: application/json

{
  "jobDescription": "5+ years PM experience...",
  "jobId": "job_456"  // Optional for caching
}

Response:
{
  "criticalKeywords": ["product management", "AI/ML", "agile"],
  "softSkills": ["leadership", "communication"],
  "technicalSkills": ["SQL", "analytics tools", "A/B testing"],
  "yearsExperience": "5+",
  "educationRequired": "Bachelor's degree"
}
```

#### Tailor Resume
```
POST /api/ai/tailor-resume
Content-Type: application/json

{
  "resume": "John Doe | Product Manager...",
  "jobDescription": "Senior PM - AI Products...",
  "jobId": "job_456"  // Optional
}

Response:
{
  "missingKeywords": ["machine learning", "LLM", "prompt engineering"],
  "bulletRewrites": [
    "Led cross-functional team of 5+ engineers to launch AI recommendation engine, increasing user engagement by 45%",
    "Implemented data-driven approach to feature prioritization, resulting in 3.2x ROI"
  ],
  "summaryRewrite": "Experienced Product Manager with 6+ years driving product strategy and go-to-market for consumer and B2B SaaS platforms. Proven track record...",
  "skillsOptimization": ["Machine Learning", "Product Strategy", "Agile"],
  "atsRecommendations": ["Add quantified metrics", "Include specific technologies", "Mirror job description language"]
}
```

#### Company Research
```
POST /api/ai/company-research
Content-Type: application/json

{
  "company": "OpenAI",
  "jobDescription": "...optional..."
}

Response:
{
  "overview": "OpenAI is an AI research and deployment company...",
  "businessModel": "API-based revenue from enterprise and consumer users",
  "productStrategy": "Focus on large language models and multimodal AI",
  "targetCustomers": "Enterprise companies, startups, developers",
  "competitors": ["Anthropic", "Google DeepMind", "Meta AI"],
  "challenges": "Regulation, competition, safety concerns",
  "opportunities": "Enterprise AI adoption, new modalities",
  "strategicPriorities": ["AGI alignment", "API scale", "Safety"]
}
```

#### Generate Interview Prep
```
POST /api/ai/interview-prep
Content-Type: application/json

{
  "company": "Google",
  "role": "Senior Product Manager",
  "resumeHighlights": "Shipped AI features, grew engagement 2x"
}

Response:
{
  "behavioralQuestions": [
    {
      "question": "Tell me about a time you had to make a difficult decision with incomplete data",
      "approach": "Use STAR method, focus on decision framework"
    }
  ],
  "productQuestions": [
    {
      "question": "How would you improve Google Search?",
      "suggested_approach": "Identify users, pain points, propose solutions"
    }
  ],
  "companyQuestions": [
    "Google's moonshot philosophy and your fit",
    "How you'd approach integrity in AI"
  ],
  "storyBank": [
    {
      "title": "Launched AI recommendation feature",
      "problem": "Low retention in content discovery",
      "action": "Led 3-month design sprint with ML team",
      "result": "45% increase in user engagement"
    }
  ]
}
```

#### ATS Scoring
```
POST /api/ai/ats-score
Content-Type: application/json

{
  "resume": "John Doe | Senior PM...",
  "jobDescription": "We're looking for a Senior PM with..."
}

Response:
{
  "keywordMatch": 82,
  "experienceLevel": 85,
  "skillAlignment": 79,
  "formatCompliance": 92,
  "overallScore": 84,
  "topGaps": ["Missing 'stakeholder management'", "No mention of metrics"],
  "quickWins": ["Add 'data-driven' to summary", "Include specific tools you use"],
  "recommendations": [
    "Increase keyword density for 'product strategy'",
    "Quantify all achievements"
  ]
}
```

#### Generate Networking Message
```
POST /api/ai/networking-message
Content-Type: application/json

{
  "recipientName": "Sarah Chen",
  "recipientRole": "Hiring Manager",
  "company": "Google",
  "jobRole": "Senior Product Manager",
  "userBackground": "5 years PM experience at startups, led AI features"
}

Response:
{
  "shortMessage": "Hi Sarah, love Google's AI initiatives. Would love to chat about the PM role. (140 chars)",
  "mediumMessage": "Hi Sarah - impressed by Google's work on responsible AI. My background in shipping and scaling AI features aligns well with your team.",
  "longMessage": "Hi Sarah,\n\nI came across the Senior PM role on your team and was excited to apply. I've had the opportunity to work on AI product development at [Company], where I led..."
}
```

---

### Resume Endpoints

#### List Resumes
```
GET /api/resumes

Response:
[
  {
    "id": "resume_123",
    "fileName": "John_Doe_Resume_v1.pdf",
    "fileUrl": "https://...",
    "version": 1,
    "title": "Resume v1",
    "isPrimary": true,
    "atsScore": 82,
    "skills": ["Product Management", "SQL", "Analytics"],
    "createdAt": "2024-01-01T10:00:00Z"
  }
]
```

#### Upload Resume
```
POST /api/resumes
Content-Type: application/json

{
  "fileName": "my_resume_v2.pdf",
  "fileUrl": "https://s3.amazonaws.com/...",
  "fileSize": 256000,
  "mimeType": "application/pdf",
  "title": "Resume v2 - AI Focus",
  "description": "Updated with new AI projects"
}

Response:
{
  "id": "resume_124",
  "version": 2,
  ...
}
```

#### Set as Primary Resume
```
PUT /api/resumes/resume_124/set-primary

Response:
{
  "id": "resume_124",
  "isPrimary": true,
  ...
}
```

---

### Dashboard Endpoints

#### Get Overview Stats
```
GET /api/dashboard/overview

Response:
{
  "totalJobs": 42,
  "thisWeekApplications": 8,
  "thisMonthApplications": 25,
  "followUpsNeeded": 3,
  "upcomingInterviews": 5,
  "jobsByStage": {
    "SAVED": 15,
    "APPLIED": 20,
    "RECRUITER_SCREEN": 4,
    "OFFER": 3
  }
}
```

#### Get Pipeline View
```
GET /api/dashboard/pipeline

Response:
{
  "SAVED": [ { job objects } ],
  "APPLIED": [ { job objects } ],
  "RECRUITER_SCREEN": [ { job objects } ],
  ...
}
```

#### Get Follow-ups Due
```
GET /api/dashboard/follow-ups

Response:
[
  {
    "id": "job_456",
    "company": "Google",
    "followUpDate": "2024-01-18",
    "recruiter": "Sarah Chen",
    "lastFollowUpAt": null
  }
]
```

---

## Error Responses

All errors return appropriate HTTP status codes:

```
400 Bad Request
{
  "error": "Description of what went wrong",
  "statusCode": 400
}

401 Unauthorized
{
  "error": "Invalid or expired token",
  "statusCode": 401
}

404 Not Found
{
  "error": "Resource not found",
  "statusCode": 404
}

500 Internal Server Error
{
  "error": "An unexpected error occurred",
  "statusCode": 500
}
```

---

## Rate Limiting

- **API Calls**: 1000 requests per hour per user
- **AI Calls**: 100 calls per hour (to manage OpenAI costs)
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Webhooks (Future)

Subscribe to events:
- Job stage changed
- Resume uploaded
- Interview scheduled
- Application progressing

---

## SDKs & Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

// Create job
const job = await client.post('/api/jobs', {
  title: 'PM Role',
  company: 'Google'
});

// Tailor resume
const tailored = await client.post('/api/ai/tailor-resume', {
  resume: resumeText,
  jobDescription: jobDescriptionText
});
```

### Python (Future)

```python
from pm_job_search import Client

client = Client(api_key='your_token')
job = client.jobs.create(title='PM', company='Google')
tailored = client.ai.tailor_resume(resume, job_desc)
```

---

## Changelog

### v1.0.0 (Current)
- Initial release
- Core job tracking
- AI resume tailoring
- Company research
- Interview prep
- dashboard
