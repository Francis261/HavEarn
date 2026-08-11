import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import termsRoutes from './routes/terms.js';
import taskRoutes from './routes/tasks.js';
import adRoutes from './routes/ads.js';
import withdrawalRoutes from './routes/withdrawals.js';
import adminRoutes from './routes/admin.js';
import nodeRoutes from './routes/nodes.js';
import legalRoutes from './routes/legal.js';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req) => req.method === 'GET' && req.path.startsWith('/api/terms'),
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/terms', termsRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/ads', adRoutes);
  app.use('/api/withdrawals', withdrawalRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/relay-nodes', nodeRoutes);
  app.use('/api/legal', legalRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}