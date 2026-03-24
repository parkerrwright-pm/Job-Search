# Deployment Guide

## Infrastructure Setup

### Prerequisites
- Docker & Docker Compose knowledge
- Git
- Domain name (optional but recommended)
- SSL certificate (automatic with Let's Encrypt)

---

## Option 1: Deploy on Railway (Recommended for MVP)

Railway makes deployment extremely easy with automatic PostgreSQL and Redis provisioning.

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/pm-job-search-engine.git
git push -u origin main
```

### Step 2: Deploy Backend
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select `backend` as the root directory
6. Add PostgreSQL plugin
7. Add Redis plugin
8. Configure environment variables:
   ```
   NODE_ENV=production
   OPENAI_API_KEY=sk-xxx
   SERPER_API_KEY=xxx
   JWT_SECRET=generate-a-secure-random-string
   ```
9. Deploy

### Step 3: Run Migrations
```bash
# In Railway dashboard, go to your backend service
# Open "Deployments" → latest deployment → "Logs"
# Run command:
npx prisma migrate deploy
```

### Step 4: Deploy Frontend
1. Create new Railway project for frontend
2. Select Next.js template
3. Connect GitHub repo
4. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-railway-url.railway.app
   ```
5. Deploy

### Environment Variables for Railway

**Backend (.env)**
```
NODE_ENV=production
DATABASE_URL=provided_by_railway
REDIS_URL=provided_by_railway
PORT=3000

OPENAI_API_KEY=sk-xxx
SERPER_API_KEY=xxx
JWT_SECRET=generate-secure-string
JWT_EXPIRY=30d
FRONTEND_URL=https://your-frontend-url.vercel.app
```

---

## Option 2: Deploy on AWS

### RDS Database
```bash
# Create PostgreSQL RDS instance
aws rds create-db-instance \
  --db-instance-identifier pm-job-search-engine \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password your-secure-password \
  --allocated-storage 20
```

### ElastiCache Redis
```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id pm-job-search-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

### ECS for Backend
```bash
# Build Docker image
docker build -f backend/Dockerfile -t pm-job-search-backend:latest ./backend

# Push to ECR
aws ecr create-repository --repository-name pm-job-search-backend
docker tag pm-job-search-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/pm-job-search-backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/pm-job-search-backend:latest

# Create ECS task definition and service
# (Use AWS console for simplicity)
```

### Vercel for Frontend
```bash
# Frontend deployment to Vercel is automatic with GitHub integration
# Just connect your repo to Vercel
```

---

## Option 3: Deploy with Docker Compose (VPS/VM)

### Prerequisites
- Linux VPS (DigitalOcean, Linode, etc.)
- Docker & Docker Compose installed
- Domain name with DNS pointing to VPS

### Step 1: Setup VPS
```bash
# SSH into VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Step 2: Clone Repository
```bash
cd /opt
git clone https://github.com/yourusername/pm-job-search-engine.git
cd pm-job-search-engine

# Create .env file
cp backend/.env.example backend/.env

# Edit with your API keys
nano backend/.env
```

### Step 3: Configure SSL (Let's Encrypt)
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Paths:
# - Certificate: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# - Key: /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Step 4: Update docker-compose.yml
```yaml
backend:
  ports:
    - "80:5000"  # or use Nginx proxy
  environment:
    DATABASE_URL: postgresql://...
    REDIS_URL: redis://redis:6379

volumes:
  # Add SSL certificates
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

### Step 5: Start Services
```bash
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

### Step 6: Setup Nginx Reverse Proxy (Optional)
```nginx
# /etc/nginx/sites-available/pm-job-search
upstream backend {
    server backend:5000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
    }
}
```

---

## Post-Deployment Checklist

- [ ] Database backups configured
- [ ] SSL certificates auto-renewing
- [ ] Monitoring & logging setup
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (New Relic / Datadog)
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Environment variables secured
- [ ] Database migrations run
- [ ] Email notifications configured
- [ ] Backup strategy documented

---

## Monitoring & Maintenance

### Logs
```bash
# View logs in real-time
docker-compose logs -f backend
docker-compose logs -f frontend

# Save logs
docker-compose logs backend > backend.log
```

### Database Backups
```bash
# Automated daily backups
0 2 * * * pg_dump $DATABASE_URL > /backups/db_$(date +\%Y-\%m-\%d).sql

# Restore from backup
psql $DATABASE_URL < /backups/db_2024-01-20.sql
```

### CI/CD Pipeline

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build backend
        run: docker build -f backend/Dockerfile -t backend:latest ./backend
      
      - name: Push to registry
        run: docker push backend:latest
      
      - name: Deploy to production
        run: |
          ssh deploy@${{ secrets.PROD_SERVER }} << 'EOF'
          cd /opt/pm-job-search-engine
          docker-compose pull
          docker-compose up -d
          EOF
```

---

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check migrations
npx prisma migrate status

# Reset database (destructive!)
npx prisma migrate reset
```

### Memory/Performance Issues
```bash
# Monitor container resources
docker stats

# Increase container memory in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

### SSL Certificate Issues
```bash
# Renew certificate
certbot renew

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/cert.pem -noout -text | grep "Not After"
```
