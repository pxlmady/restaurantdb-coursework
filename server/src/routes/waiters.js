// CRUD офіціантів (таблиця Waiter)
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/http-error.js';
import { parseId, text, validate } from '../lib/validation.js';

export const waitersRouter = Router();

const schema = { full_name: text({ max: 100 }) };

const include = { _count: { select: { orders: true } } };

const toJson = ({ _count, ...waiter }) => ({ ...waiter, orders_count: _count.orders });

const findOr404 = async (id) => {
  const waiter = await prisma.waiter.findUnique({ where: { id_waiter: id }, include });
  if (!waiter) throw notFound(`Офіціанта №${id} не знайдено`);
  return waiter;
};

waitersRouter.get('/', async (_req, res) => {
  const waiters = await prisma.waiter.findMany({ include, orderBy: { id_waiter: 'asc' } });
  res.json(waiters.map(toJson));
});

waitersRouter.get('/:id', async (req, res) => {
  res.json(toJson(await findOr404(parseId(req.params.id))));
});

waitersRouter.post('/', async (req, res) => {
  const data = validate(req.body, schema);
  const waiter = await prisma.waiter.create({ data, include });
  res.status(201).json(toJson(waiter));
});

waitersRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, schema);
  await findOr404(id);
  const waiter = await prisma.waiter.update({ where: { id_waiter: id }, data, include });
  res.json(toJson(waiter));
});

// Видалення блокується, якщо офіціант обслуговував замовлення (FK_Order_Waiter)
waitersRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { _count } = await findOr404(id);
  if (_count.orders > 0) {
    throw conflict(`Неможливо видалити офіціанта: за ним є замовлення (${_count.orders})`);
  }
  await prisma.waiter.delete({ where: { id_waiter: id } });
  res.status(204).end();
});
