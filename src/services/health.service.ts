import mongoose from 'mongoose';
import config from '../config/env';

export interface MemoryInfo {
  rss: number;
  heapUsed: number;
  heapTotal: number;
}

export interface RuntimeInfo {
  nodeVersion: string;
  memory: MemoryInfo;
}

export interface ServerHealth {
  status: 'up';
}

export interface DatabaseHealth {
  status: 'connected' | 'connecting' | 'disconnecting' | 'disconnected';
}

export interface SystemHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  server: ServerHealth;
  database: DatabaseHealth;
  runtime: RuntimeInfo;
}

export const getSystemHealth = (): SystemHealthResponse => {
  const readyState = mongoose.connection.readyState;

  let dbStatus: DatabaseHealth['status'];
  switch (readyState) {
    case 1:
      dbStatus = 'connected';
      break;
    case 2:
      dbStatus = 'connecting';
      break;
    case 3:
      dbStatus = 'disconnecting';
      break;
    case 0:
    default:
      dbStatus = 'disconnected';
      break;
  }

  const isHealthy = dbStatus === 'connected';
  const memUsage = process.memoryUsage();

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 100) / 100,
    environment: config.nodeEnv,
    server: {
      status: 'up',
    },
    database: {
      status: dbStatus,
    },
    runtime: {
      nodeVersion: process.version,
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
    },
  };
};
