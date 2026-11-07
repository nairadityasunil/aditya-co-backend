import express, { Application, Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middleware/error.middleware';
import connectDB from './config/db';
import config from './config/env';
import logger from './utils/logger';
import { getSystemHealth } from './services/health.service';

class App {
  public app: Application;
  public server: http.Server;
  public port: number;

  constructor(routes: Routes[]) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.port = config.port;

    // Configure trust proxy for Render reverse proxy environment
    this.app.set('trust proxy', 1);

    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeHealthCheck();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const cleanOrigin = origin.replace(/\/$/, '');
          const allowedOrigins = config.cors.allowedOrigins.map((o) => o.trim().replace(/\/$/, ''));
          if (
            allowedOrigins.includes(cleanOrigin) ||
            cleanOrigin.startsWith('http://localhost:') ||
            cleanOrigin.startsWith('http://127.0.0.1:') ||
            !config.isProduction
          ) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked: ${origin}`));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    // Prevent HTTP Parameter Pollution
    this.app.use(hpp());

    // Sanitize MongoDB queries
    this.app.use(mongoSanitize());

    // Global rate limiter
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request logging (exclude /health polling from debug logs)
    if (!config.isProduction) {
      this.app.use((req, _res, next) => {
        if (req.path !== '/health') {
          logger.debug(`${req.method} ${req.path}`);
        }
        next();
      });
    }
  }

  private initializeRoutes(routes: Routes[]): void {
    routes.forEach((route) => {
      this.app.use('/', route.router);
    });
  }

  private initializeHealthCheck(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      try {
        const health = getSystemHealth();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Health check execution error: ${message}`);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          uptime: Math.round(process.uptime() * 100) / 100,
          environment: config.nodeEnv,
          server: { status: 'up' },
          database: { status: 'disconnected' },
          runtime: {
            nodeVersion: process.version,
            memory: {
              rss: process.memoryUsage().rss,
              heapUsed: process.memoryUsage().heapUsed,
              heapTotal: process.memoryUsage().heapTotal,
            },
          },
        });
      }
    });
  }

  private initializeErrorHandling(): void {
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
    });
    this.app.use(errorMiddleware);
  }

  public async listen(): Promise<void> {
    logger.info('Starting application...');
    await connectDB();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection failed to reach readyState 1 (connected).');
    }
    this.server.listen(this.port, () => {
      logger.info(`Server listening on port ${this.port}`);
      const health = getSystemHealth();
      const statusLabel = health.status === 'healthy' ? 'HEALTHY' : 'UNHEALTHY';
      logger.info(`Startup health check: ${statusLabel}`);
    });
  }
}

export default App;
