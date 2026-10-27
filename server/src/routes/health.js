import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

// Перевірка працездатності сервера
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Перевірка підключення до SQL Server
healthRouter.get('/db', async (_req, res) => {
  try {
    const [row] = await prisma.$queryRaw`SELECT DB_NAME() AS name`;
    res.json({ status: 'ok', database: 'connected', name: row.name });
  } catch (err) {
    console.error('Помилка підключення до бази даних:', err.message);
    res.status(503).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'База даних недоступна', details: [] },
    });
  }
});
