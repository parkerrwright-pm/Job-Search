#!/bin/bash

# PM Job Search Engine - Quick Start Script
# This script sets up the project locally with all dependencies

set -e

echo "🚀 PM Job Search Engine - Quick Start Setup"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm --version)${NC}"

# Check docker compose command availability (optional for local non-docker workflow)
DOCKER_COMPOSE_CMD=""
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
fi

echo ""
echo -e "${BLUE}📦 Setting up backend...${NC}"

# Backend setup
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
else
    echo "Backend dependencies already installed"
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating backend .env file..."
    cp .env.example .env
    echo -e "${BLUE}⚠️  Please edit backend/.env with your API keys:${NC}"
    echo "   - OPENAI_API_KEY"
    echo "   - SERPER_API_KEY"
    echo "   - DATABASE_URL (default is local PostgreSQL)"
    echo "   - REDIS_URL (default is local Redis)"
fi

# Check if Prisma setup is done
if [ ! -d "node_modules/.prisma" ]; then
    echo "Setting up Prisma..."
    npx prisma generate
fi

echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""

# Frontend setup
cd ../frontend

echo -e "${BLUE}📦 Setting up frontend...${NC}"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "Frontend dependencies already installed"
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "Creating frontend .env.local file..."
    cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME="PM Job Search Engine"
EOF
fi

echo -e "${GREEN}✅ Frontend setup complete${NC}"
echo ""

# Return to root
cd ..

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo ""
echo "1. Make sure PostgreSQL and Redis are running:"
if [ -n "$DOCKER_COMPOSE_CMD" ]; then
    echo "   $DOCKER_COMPOSE_CMD up -d postgres redis"
else
    echo "   Docker Compose not detected. Install Docker Desktop, then run:"
    echo "   docker compose up -d postgres redis"
fi
echo ""
echo "2. In one terminal, start the backend:"
echo "   cd backend && npm run dev"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Open your browser:"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:5000"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   README.md - Project overview"
echo "   docs/ARCHITECTURE.md - System design"
echo "   docs/API.md - API documentation"
echo "   docs/DEPLOYMENT.md - Deployment guide"
echo ""
echo -e "${BLUE}💡 First time setup tips:${NC}"
echo "   • Edit backend/.env with your OpenAI and Serper API keys"
echo "   • Recommended to test locally first before deploying"
echo "   • Check docs/DEPLOYMENT.md for production setup"
echo ""
