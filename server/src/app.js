import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { dictionariesRouter } from './routes/dictionaries.js';
import { visitorsRouter } from './routes/visitors.js';
import { tablesRouter } from './routes/tables.js';
import { waitersRouter } from './routes/waiters.js';
import { dishesRouter } from './routes/dishes.js';
import { reservationsRouter } from './routes/reservations.js';
import { ordersRouter } from './routes/orders.js';

export const app = express();

app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/dictionaries', dictionariesRouter);

// CRUD сутностей RestaurantDB (етап 6)
app.use('/api/visitors', visitorsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/waiters', waitersRouter);
app.use('/api/dishes', dishesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/orders', ordersRouter); // разом з позиціями: /api/orders/:id/details

app.use(notFoundHandler);
app.use(errorHandler);
