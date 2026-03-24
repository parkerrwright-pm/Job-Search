import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import jobRoutes from './routes/jobs';
import aiRoutes from './routes/ai';
import resumeRoutes from './routes/resumes';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import authRoutes from './routes/auth';

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app: Express = express();
export const prisma = new PrismaClient();

// Middleware
app.use(helmet());
const configuredOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
const localhostDevOrigin = /^http:\/\/localhost:\d+$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (origin === configuredOrigin) {
        callback(null, true);
        return;
      }

      if (process.env.NODE_ENV !== 'production' && localhostDevOrigin.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('combined'));
app.use(requestLogger);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handling Middleware
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Allow long-running AI requests to complete without premature timeout
server.setTimeout(300_000);      // 5 minutes for request completion
server.keepAliveTimeout = 120_000; // 2 minutes keep-alive
server.headersTimeout = 305_000;   // slightly above setTimeout

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
