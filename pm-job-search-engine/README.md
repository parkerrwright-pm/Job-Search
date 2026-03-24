# 📌 PM Job Search Engine - Complete Setup Guide

## 🎯 Project Overview

**PM Job Search Engine** is a production-ready AI-powered platform that helps Product Managers and professionals automate and optimize their job search process. It combines advanced AI (GPT-4), web search APIs, and intelligent ATS optimization to increase application success rates.

### ✨ What Does It Do?

- 📊 **Job Pipeline Tracker** - Notion-style Kanban board to manage your entire job search process
- 🧠 **AI Resume Tailor** - Automatically optimize resumes for specific jobs with ATS keyword analysis
- 🔍 **Company Research Engine** - Get instant competitive insights and strategic context
- 🎤 **Interview Prep** - Generate mock questions, STAR stories, and company-specific preparation
- 💬 **Networking Message Generator** - Create personalized outreach messages for recruiters
- ⭐ **ATS & VMOCK Scoring** - Simulate ATS parser scoring and get improvement recommendations
- 📈 **Dashboard Command Center** - Overview of all applications, follow-ups, and upcoming interviews

---

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React meta-framework with server components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **ShadCN UI** - Accessible component library
- **React Hook Form + Zod** - Form validation and type-safety
- **TanStack Query (React Query)** - Server state management
- **Zustand** - Client state management

### Backend
- **Node.js + Express** - Lightweight, scalable HTTP server
- **TypeScript** - Type-safe backend
- **Prisma ORM** - Database abstraction with migrations
- **PostgreSQL** - Robust relational database
- **Redis** - Caching and job queue
- **OpenAI API** - GPT-4 for AI features
- **Bull** - Background job processing
- **Winston** - Structured logging

### External APIs
- **OpenAI GPT-4** - LLM for all AI-powered features
- **Serper API** - Web search for company research
- **Tavily API** - Advanced research capability (optional)
- **NextAuth.js** - OAuth and session management

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ ([download](https://nodejs.org))
- **Docker & Docker Compose** (optional, for local database)
- **PostgreSQL** 14+ (or Docker)
- **Redis** (or Docker)
- **API Keys**:
  - OpenAI API key ([get here](https://platform.openai.com/api-keys))
  - Serper API key ([get here](https://serper.dev))

### Option 1: Local Development (with Docker)

```bash
# 1. Clone the repository
git clone <repo-url>
cd pm-job-search-engine

# 2. Create backend .env file
cp backend/.env.example backend/.env

# Edit backend/.env with your API keys:
# OPENAI_API_KEY=sk-xxx
# SERPER_API_KEY=xxx

# 3. Start Docker containers
docker compose up -d

# 4. Run migrations
docker compose exec backend npm run migrate

# 5. Access the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

### Option 2: Manual Local Development

```bash
# Backend Setup
cd backend
npm install
cp .env.example .env

# Configure .env with PostgreSQL and Redis connection strings
# Then run migrations:
npx prisma migrate dev

# Start backend
npm run dev

# Frontend Setup (new terminal)
cd frontend
npm install

# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:5000

# Start frontend
npm run dev

# Access http://localhost:3000
```

---

## 📁 Project Structure

```
pm-job-search-engine/
├── frontend/                          # Next.js React application
│   ├── src/
│   │   ├── components/               # Reusable React components
│   │   │   ├── JobCard.tsx          
│   │   │   ├── JobForm.tsx          
│   │   │   ├── KanbanBoard.tsx      
│   │   │   ├── ResumeTailor.tsx     
│   │   │   ├── CompanyResearch.tsx  
│   │   │   ├── DashboardStats.tsx   
│   │   │   └── Navbar.tsx
│   │   ├── pages/                   # Next.js pages (routes)
│   │   │   ├── dashboard.tsx        # Main dashboard
│   │   │   ├── jobs.tsx             # Job pipeline
│   │   │   ├── ai-tailor.tsx        # Resume tailor
│   │   │   ├── company-research.tsx # Company research
│   │   │   ├── interview-prep.tsx   # Interview preparation
│   │   │   ├── settings.tsx         # User settings
│   │   │   └── login.tsx            # Authentication
│   │   ├── lib/                     # Utilities and helpers
│   │   │   ├── api-client.ts       # API call wrapper
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   └── utils.ts
│   │   └── styles/                 # Global styles
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   └── .env.local               # Environment variables
│
├── backend/                          # Express.js API server
│   ├── src/
│   │   ├── index.ts               # Express app entry
│   │   ├── routes/                # API route handlers
│   │   │   ├── jobs.ts           # /api/jobs routes
│   │   │   ├── ai.ts             # /api/ai routes
│   │   │   ├── resumes.ts        # /api/resumes routes
│   │   │   ├── dashboard.ts      # /api/dashboard routes
│   │   │   ├── auth.ts           # /api/auth routes
│   │   │   └── settings.ts       # /api/settings routes
│   │   ├── services/              # Business logic
│   │   │   ├── jobService.ts
│   │   │   ├── resumeService.ts
│   │   │   └── aiService.ts
│   │   ├── middleware/            # Express middleware
│   │   │   ├── auth.ts           # JWT authentication
│   │   │   ├── errorHandler.ts   # Global error handling
│   │   │   └── requestLogger.ts  # Request logging
│   │   ├── utils/
│   │   │   ├── aiService.ts      # AI/LLM integration
│   │   │   └── validators.ts     # Input validation
│   │   └── types/                # TypeScript types
│   │
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   └── seed.ts               # Database seeding
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
│
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md           # System design
│   ├── API.md                   # API documentation
│   ├── DATABASE.md              # Database schema
│   ├── DEPLOYMENT.md            # Deployment guide
│   └── CONTRIBUTING.md          # Contribution guidelines
│
├── docker-compose.yml           # Docker orchestration
├── .gitignore
├── README.md                    # This file
└── ARCHITECTURE.md              # Detailed architecture

```

---

## 🔧 Configuration

### Environment Variables

**Frontend (.env.local)**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXTAUTH_SECRET=your-secret-key
```

**Backend (.env)**
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# APIs
OPENAI_API_KEY=sk-xxx
SERPER_API_KEY=xxx
TAVILY_API_KEY=xxx

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=30d

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout

### Jobs
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `PUT /api/jobs/:id/stage` - Update job stage
- `GET /api/jobs/:id/timeline` - Get application timeline

### AI Features
- `POST /api/ai/analyze-job` - Extract keywords from job
- `POST /api/ai/tailor-resume` - Optimize resume for job
- `POST /api/ai/company-research` - Research company
- `POST /api/ai/interview-prep` - Generate interview prep
- `POST /api/ai/ats-score` - Score resume vs ATS
- `POST /api/ai/networking-message` - Generate outreach
- `POST /api/ai/linkedin-optimizer` - Optimize LinkedIn profile

### Resumes
- `GET /api/resumes` - List resume versions
- `POST /api/resumes` - Upload new resume
- `GET /api/resumes/:id` - Get resume
- `PUT /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume

### Dashboard
- `GET /api/dashboard/overview` - Dashboard stats
- `GET /api/dashboard/upcoming-interviews` - Upcoming interviews
- `GET /api/dashboard/follow-ups` - Follow-ups due
- `GET /api/dashboard/pipeline` - Full pipeline view

---

## 🎨 Key Features Deep Dive

### 1. Job Pipeline (Kanban Board)
- Drag-and-drop job cards between stages
- 8 stages: Saved → Applied → Offer/Rejected
- Filter by priority, company, stage
- Real-time updates

### 2. AI Resume Tailor
- Paste resume and job description
- Get AI-powered suggestions:
  - Missing keywords
  - Rewritten bullet points
  - Professional summary
  - Skills optimization

### 3. Company Research
- Enter company name
- Automatic web search + LLM synthesis
- Get: overview, business model, competitors, challenges, opportunities
- Results cached for 48 hours

### 4. Interview Prep
- 15+ behavioral questions
- 10+ product thinking questions
- STAR story generator
- Company-specific questions

### 5. Dashboard
- Visual pipeline overview
- This week's applications
- Upcoming interviews
- Follow-ups due
- Quick action buttons

---

## 🚀 Deployment

### Deploy Frontend (Vercel - Recommended)
```bash
# Connect GitHub repo to Vercel
# Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Deploy automatically on push to main
```

### Deploy Backend (Railway/Render)
```bash
# Option A: Railway
# 1. Connect GitHub repo
# 2. Add PostgreSQL plugin
# 3. Add Redis plugin
# 4. Set environment variables
# 5. Deploy

# Option B: Docker + Docker Compose
docker build -f backend/Dockerfile -t job-search-api:latest ./backend
docker run -e DATABASE_URL=<url> -e OPENAI_API_KEY=<key> job-search-api:latest
```

### Deploy Database
```bash
# Use managed PostgreSQL service:
# - Vercel PostgreSQL
# - AWS RDS
# - DigitalOcean Managed Database
# - Railway PostgreSQL (recommended)

# Run migrations post-deployment:
npx prisma migrate deploy
```

---

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm run test
npm run test:watch

# Backend tests
cd backend
npm run test
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## 📊 Database Schema

### Core Tables
- **users** - User accounts
- **jobs** - Job applications (pipeline)
- **resumes** - Resume versions
- **ai_analyses** - AI results cache
- **research_cache** - Company research results
- **interview_prep** - Interview preparation data
- **networking_messages** - Generated messages
- **activity_logs** - Application history

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full schema details.

---

## 🔐 Security

- ✅ JWT authentication with expiring tokens
- ✅ SQL injection prevention (Prisma ORM)
- ✅ CORS configuration
- ✅ Helmet.js headers security
- ✅ Input validation with Zod
- ✅ Environment variable protection
- ✅ Rate limiting (ready to implement)
- ✅ HTTPS enforcement in production

---

## 📈 Performance

- ⚡ Frontend code-splitting with Next.js
- ⚡ API response caching (Redis)
- ⚡ Database query optimization (Prisma)
- ⚡ Image optimization
- ⚡ Lazy loading components
- ⚡ CDN for static assets (Vercel Edge)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for more details.

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🆘 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U postgres -d job_search_engine

# Reset migrations
npx prisma migrate reset

# View database
npx prisma studio
```

### API Not Responding
```bash
# Check backend is running
curl http://localhost:5000/health

# View logs
docker logs pm-job-search-engine-backend-1
```

### Frontend Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Run dev server
npm run dev
```

---

## 📞 Support

- 📧 Email: support@pmjobsearch.com
- 🐛 Bug Reports: GitHub Issues
- 💡 Feature Requests: GitHub Discussions
- 📚 Documentation: See /docs folder

---

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Prisma for excellent ORM
- Vercel for Next.js and deployment
- TanStack for React Query
- ShadCN for component library

---

**Happy job searching! 🎯**
