// Довідники для форм клієнта: допустимі статуси (обмеження CHECK у базі)
import { Router } from 'express';
import { PAYMENT_STATUSES, RESERVATION_STATUSES } from '../domain/dictionaries.js';

export const dictionariesRouter = Router();

dictionariesRouter.get('/', (_req, res) => {
  res.json({ reservation_statuses: RESERVATION_STATUSES, payment_statuses: PAYMENT_STATUSES });
});
