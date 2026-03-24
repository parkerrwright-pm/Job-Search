# PM Job Search Engine - System Architecture

## Overview

A production-ready AI-powered job search platform that helps users track applications, optimize resumes, research companies, and prepare for interviews.

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ with TypeScript
- **UI**: React 18+
- **Styling**: Tailwind CSS
- **Component Library**: ShadCN UI
- **State Management**: Zustand + React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5+
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Job Queue**: Bull (Redis)
- **AI/Search**: OpenAI SDK, Serper API, Tavily API

### Infrastructure
- **Database**: PostgreSQL (Vercel or AWS RDS)
- **Cache**: Redis
- **Storage**: AWS S3 or Vercel Blob
- **Authentication**: NextAuth.js
- **Deployment**: Vercel (frontend) + Railway/Heroku (backend)

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
│  Next.js Frontend + React Components + Tailwind CSS         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    HTTP/REST API
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              NODE.JS / EXPRESS BACKEND                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  API Routes  │  │  Middleware  │  │  Controllers │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           SERVICE LAYER (Business Logic)             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐   │  │
│  │  │ Resume AI   │ │ Job Search  │ │ ATS Scoring │   │  │
│  │  │ Service     │ │ Service     │ │ Service     │   │  │
│  │  └─────────────┘ └─────────────┘ └──────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        EXTERNAL INTEGRATIONS LAYER                  │  │
│  │  ┌──────────────┐  ┌──────────┐  ┌────────────┐   │  │
│  │  │ OpenAI API   │  │Serper/   │  │ Tavily API │   │  │
│  │  │ LLM Engine   │  │Bing API  │  │ Search     │   │  │
│  │  └──────────────┘  └──────────┘  └────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐         ┌──────┐         ┌────────┐
   │PostgreSQL│         │Redis │         │AWS S3  │
   │Database  │         │Cache │         │Storage │
   └─────────┘         └──────┘         └────────┘
```

---

## Data Flow Architecture

### 1. Job Pipeline (User Submits Job URL)
```
User Input (Job Link)
    ↓
Parse Job Description
    ↓
Extract Keywords + Metadata
    ↓
Store in Database
    ↓
Trigger AI Analysis Pipeline
    ↓
Return to Frontend
```

### 2. Resume Tailoring Flow
```
User Upload Resume + Job Description
    ↓
Parse Resume & JD
    ↓
LLM Analysis (OpenAI GPT-4)
    ↓
ATS Keyword Extraction
    ↓
Generate Tailored Content
    ↓
Return Suggestions + Scores
```

### 3. Company Research Flow
```
User Input (Company Name + Job URL)
    ↓
Web Search (Serper/Tavily)
    ↓
LLM Synthesis (Research Analysis)
    ↓
Extract Insights
    ↓
Cache Results (Redis)
    ↓
Return Insights to Frontend
```

---

## API Layer Architecture

### RESTful Endpoints
```
/api/auth/
  POST /login
  POST /signup
  POST /logout

/api/jobs/
  GET /                (list all jobs)
  POST /               (create job)
  GET /:id             (get job details)
  PUT /:id             (update job)
  DELETE /:id          (delete job)
  GET /:id/timeline    (get application timeline)

/api/ai/
  POST /analyze-job              (keyword extraction)
  POST /tailor-resume            (resume optimization)
  POST /company-research         (company insights)
  POST /interview-prep           (mock questions)
  POST /networking-message       (generate messages)
  POST /linkedin-optimizer       (LinkedIn content)
  POST /ats-scoring              (ATS mock scoring)
  POST /recruiter-search-optimize (search keywords)

/api/resumes/
  GET /                          (list versions)
  POST /                         (upload new version)
  GET /:id                       (get specific version)
  PUT /:id                       (update version)
  POST /:id/export               (export as PDF)

/api/dashboard/
  GET /overview                  (dashboard stats)
  GET /upcoming-interviews       (next 30 days)
  GET /follow-ups               (due follow-ups)
  GET /weekly-summary           (this week stats)

/api/settings/
  GET /                         (user settings)
  PUT /                         (update settings)
  POST /preferences             (AI preferences)
```

---

## Database Schema Overview

### Core Tables
- **users** - User accounts & authentication
- **jobs** - Job applications pipeline
- **resumes** - Resume versions
- **ai_analyses** - AI analysis results cache
- **research_cache** - Company research cache
- **interview_prep** - Interview preparation data
- **networking_messages** - Generated messages
- **activity_log** - Application timeline

---

## Service Layer Architecture

### 1. Resume Tailoring Service
```typescript
class ResumeTailoringService {
  - parseResume()
  - parseJobDescription()
  - extractKeywords()
  - analyzeKeywordDensity()
  - generateBulletPoints()
  - optimizeForATS()
  - scoreResume()
}
```

### 2. Job Search Service
```typescript
class JobSearchService {
  - parseJobURL()
  - scrapeJobDescription()
  - extractMetadata()
  - categorizeRole()
  - estimateSalary()
  - identifyCompetitors()
}
```

### 3. Company Research Service
```typescript
class CompanyResearchService {
  - searchCompanyInfo()
  - analyzeBusinessModel()
  - identifyCompetitors()
  - extractStrategicPriorities()
  - synthesizeInsights()
}
```

### 4. AI Service (LLM Integration)
```typescript
class AIService {
  - callOpenAI()
  - streamResponse()
  - cacheResults()
  - retryWithBackoff()
}
```

### 5. ATS Scoring Service
```typescript
class ATSScoringService {
  - scoreKeywordDensity()
  - scoreMetrics()
  - scoreActionVerbs()
  - scoreStructure()
  - generateReport()
}
```

---

## Frontend Components Hierarchy

```
App Layout
├── Dashboard
│   ├── StatsOverview
│   ├── JobPipeline
│   ├── UpcomingInterviews
│   └── QuickActions
├── JobTracker
│   ├── KanbanBoard
│   ├── TableView
│   ├── JobCard
│   └── JobForm
├── ResumeTailor
│   ├── UploadForm
│   ├── KeywordAnalysis
│   ├── BulletPointSuggestions
│   └── PreviewPanel
├── CompanyResearch
│   ├── SearchForm
│   ├── ResearchResults
│   ├── InsightsPanel
│   └── StrategicMapping
├── InterviewPrep
│   ├── QuestionGenerator
│   ├── StoryBuilder
│   └── MockInterviewMode
└── Settings
    ├── ProfileSettings
    ├── PreferencesForm
    └── APIConfiguration
```

---

## Deployment & DevOps

### Frontend Deployment
- **Hosting**: Vercel
- **CDN**: Vercel Edge Network
- **CI/CD**: GitHub Actions → Vercel

### Backend Deployment
- **Hosting**: Railway or Heroku
- **Container**: Docker
- **CI/CD**: GitHub Actions → Container Registry

### Database & Cache
- **DB**: Vercel PostgreSQL or AWS RDS
- **Cache**: Redis (Upstash or self-hosted)
- **Backups**: Automated daily

---

## Security Architecture

### Authentication & Authorization
- NextAuth.js for session management
- JWT tokens for API authentication
- Row-level security (RLS) on database

### Data Protection
- HTTPS/TLS for all traffic
- Environment variables for secrets
- API rate limiting
- Request validation with Zod

### API Security
- CORS configuration
- CSRF protection
- SQL injection prevention (Prisma ORM)
- XSS protection in React

---

## Performance Optimization

### Frontend
- Code splitting with Next.js dynamic imports
- Image optimization
- Caching strategies (SWR, React Query)
- Service Worker for offline support

### Backend
- Database connection pooling
- Redis caching for AI results
- API response compression
- Pagination for large datasets

### AI/Search
- Prompt caching to reduce API calls
- Results caching (24-48 hours)
- Batch processing for bulk operations

---

## Error Handling & Monitoring

### Logging
- Winston for structured logging
- Sentry for error tracking
- DataDog for performance monitoring

### Error Recovery
- Automatic retry logic for API calls
- Graceful degradation on failures
- User-friendly error messages

---

## Scalability Considerations

1. **Horizontal Scaling**: Stateless backend services
2. **Database**: Connection pooling, read replicas
3. **Caching**: Multi-layer caching strategy
4. **Background Jobs**: Bull queue for async processing
5. **CDN**: Static assets on edge network
