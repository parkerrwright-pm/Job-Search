# 🎓 Quick Reference Guide

## What You Have

A complete, production-ready **Job Search Engine** application with:

✅ **Frontend** - Modern React/Next.js webapp with beautiful UI
✅ **Backend** - Express.js API with AI integrations  
✅ **Database** - PostgreSQL with Prisma ORM
✅ **AI** - OpenAI GPT-4 integration for 8 AI features
✅ **Documentation** - 3000+ lines of guides and references
✅ **Docker** - Full containerization for easy deployment

---

## 📂 Where Everything Is

### `/frontend` - React App
- Components you can customize
- Pages for each feature
- Tailwind CSS styling

### `/backend` - API Server
- Routes for all features
- AI/LLM integration
- Database setup

### `/docs` - Complete Docs
- ARCHITECTURE.md - System design
- API.md - Endpoint reference  
- DEPLOYMENT.md - How to deploy
- UI_WIREFRAMES.md - Design specs

### Root Files
- README.md - Full project guide
- docker-compose.yml - Run everything
- setup.sh - Quick start script

---

## 🚀 Getting Started (Pick One)

### Method 1: Fast Track (5 min with Docker)
```bash
cd pm-job-search-engine

# Setup .env with your API keys
nano backend/.env
# Add: OPENAI_API_KEY, SERPER_API_KEY

# Start everything
docker compose up -d

# That's it! Open http://localhost:3000
```

### Method 2: Local Dev (10 min)
```bash
cd pm-job-search-engine
chmod +x setup.sh
./setup.sh

# Follow the printed instructions to start backend & frontend
```

### Method 3: Full Manual
```bash
# Backend (Terminal 1)
cd backend
npm install
npm run dev

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev

# Open http://localhost:3000
```

---

## 🔑 API Keys You Need

1. **OpenAI** - For AI features
   - Get from: https://platform.openai.com/api-keys
   - Add to: `backend/.env` as `OPENAI_API_KEY`

2. **Serper** - For web search  
   - Get from: https://serper.dev
   - Add to: `backend/.env` as `SERPER_API_KEY`

3. **Optional: Tavily** - Better research
   - Get from: https://tavily.com
   - Add to: `backend/.env` as `TAVILY_API_KEY`

---

## 📋 Main Features

### 1. Job Pipeline
Add jobs → Track them on Kanban board → Move through 8 stages

### 2. Resume Tailor
Paste resume + job description → Get keyword suggestions + rewrites

### 3. Company Research  
Enter company name → Get instant research (business model, competitors, etc)

### 4. Interview Prep
Generate mock questions, STAR stories, company-specific prep

### 5. Dashboard
See overview of all jobs, applications, follow-ups, interviews

### 6. Networking  
Generate personalized outreach messages to recruiters

### 7. Resume Versions
Store multiple resume versions, tag which one you used for each job

### 8. ATS Scoring
Check how well your resume matches the job criteria (simulates ATS parser)

---

## 🏗️ Architecture (Simple Overview)

```
User Opens App (localhost:3000)
           ↓
    React Frontend
- Dashboard, forms, tables
- Calls backend APIs
           ↓
  Express API Server (localhost:5000)
- Routes: /api/jobs, /api/ai, /api/resumes, etc.
- Calls OpenAI & Web Search APIs
           ↓
    PostgreSQL Database
- Stores jobs, resumes, users
- Caches AI results
```

---

## 💾 Database Setup

The database is created automatically. To manually set it up:

```bash
cd backend

# Create the database schema
npx prisma migrate dev --name init

# View your data (optional)
npx prisma studio
```

---

## 🧪 Testing the App

### As a User:
1. Go to http://localhost:3000
2. Create account (or login)
3. Add a job
4. On that job, click "Tailor Resume" or "Research Company"
5. See AI results

### Via API:
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# You'll get a token back - use it in Authorization header

# Create job
curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior PM",
    "company": "Google",
    "location": "Mountain View",
    "salary": "$200k-250k"
  }'
```

See `docs/API.md` for all endpoints.

---

## 📁 Key Files to Know

### Frontend
- `frontend/src/pages` - Main app pages
- `frontend/src/components` - Reusable components
- `frontend/package.json` - Dependencies

### Backend
- `backend/src/routes` - API endpoints
- `backend/src/utils/aiService.ts` - AI prompts & logic
- `backend/prisma/schema.prisma` - Database schema
- `backend/package.json` - Dependencies

### Docs
- `README.md` - Start here
- `ARCHITECTURE.md` - System design
- `docs/API.md` - API reference
- `docs/DEPLOYMENT.md` - Deploy to production

---

## 🚀 Deployment

### To Production (Simplest: Railway)

1. Push code to GitHub
2. Go to railway.app
3. Click "New Project"
4. Deploy from GitHub
5. Add PostgreSQL plugin
6. Set environment variables
7. Done!

See `docs/DEPLOYMENT.md` for other options (AWS, VPS, etc)

---

## 🛠️ Development Commands

### Frontend
```bash
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production  
npm run lint       # Check code
npm run test       # Run tests
```

### Backend
```bash
cd backend
npm run dev        # Start dev server
npm run build      # Compile TypeScript
npm run migrate    # Create DB tables
npm run seed       # Add test data
npm run test       # Run tests
```

---

## 📊 Customization Examples

### Change Colors
Edit `frontend/tailwind.config.ts` - update color palette

### Add New Job Field
1. Edit `backend/prisma/schema.prisma` (add field to Job model)
2. Run `npx prisma migrate dev`
3. Update `JobForm.tsx` to include new field
4. Update job routes to handle it

### Improve AI Prompts
Edit `backend/src/utils/aiService.ts` - modify `PROMPTS` object

### Change Dashboard Layout
Edit `frontend/src/pages/dashboard.tsx` - restructure components

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Or start it
docker-compose up -d postgres
```

### "API key is invalid"
- Check OpenAI key is correct (starts with `sk-`)
- Check Serper key is valid
- Make sure you added them to `backend/.env`

### "Port 3000/5000 already in use"
```bash
# Kill the process using the port
lsof -i :3000
kill -9 <PID>

# Or use different ports in docker-compose.yml
```

### "Cannot find module @/components"
- Make sure you're in the right directory
- Run `npm install` again
- Restart the dev server

---

## 📚 Learning Resources in This Repo

- **ARCHITECTURE.md** - Understand how everything connects
- **API.md** - Learn every endpoint with examples
- **UI_WIREFRAMES.md** - See the design system
- **PROJECT_COMPLETION.md** - See what was generated
- **FEATURES_ROADMAP.md** - Ideas for future development

---

## 💡 Pro Tips

1. **Local Testing**: Keep using `localhost:3000` while you develop
2. **Data Inspection**: Use `npx prisma studio` to view/edit data visually
3. **API Testing**: Use Postman or `curl` to test endpoints before integrating
4. **AI Cost**: Results are cached to reduce OpenAI API costs
5. **Debugging**: Check `backend` logs with `docker logs backend`

---

## 🎯 Next Steps

1. ✅ Get API keys (OpenAI, Serper)
2. ✅ Start the app (Docker or manual)
3. ✅ Create an account
4. ✅ Add a job
5. ✅ Try each feature (Resume Tailor, Research, etc)
6. ✅ Read the docs to understand architecture
7. ✅ Deploy to production (Railway recommended)
8. ✅ Customize for your needs

---

## 📞 Support Resources

- **Stuck?** Check `docs/DEPLOYMENT.md` troubleshooting section
- **Want to customize?** Read `ARCHITECTURE.md` first
- **API questions?** See `docs/API.md`
- **UI changes?** Check `docs/UI_WIREFRAMES.md`

---

## ✨ You're Ready!

Everything is set up for immediate development. The app is:
- ✅ Fully functional
- ✅ Production-ready
- ✅ Well-documented
- ✅ Easy to deploy
- ✅ Ready to customize

**Now go build something amazing!** 🚀

---

**Questions?** Check the relevant documentation guide listed above.
**Want to contribute?** See CONTRIBUTING.md (in docs folder)
**Ready to deploy?** Follow docs/DEPLOYMENT.md
