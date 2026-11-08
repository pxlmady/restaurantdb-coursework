// CRUD столиків (таблиця [Table]). Номер столика — первинний ключ без IDENTITY:
// задається під час створення і після цього не змінюється.
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/http-error.js';
import { integer, parseId, validate } from '../lib/validation.js';

export const tablesRouter = Router();

const MAX_INT = 2147483647;
const capacity = integer({ min: 1, max: 1000 });
const createSchema = { table_number: integer({ min: 1, max: MAX_INT }), capacity };
const updateSchema = { capacity };

const include = { _count: { select: { reservations: true, orders: true } } };

const toJson = ({ _count, ...table }) => ({
  ...table,
  reservations_count: _count.reservations,
  orders_count: _count.orders,
});

const findOr404 = async (number) => {
  const table = await prisma.table.findUnique({ where: { table_number: number }, include });
  if (!table) throw notFound(`Столик №${number} не знайдено`);
  return table;
};

tablesRouter.get('/', async (_req, res) => {
  const tables = await prisma.table.findMany({ include, orderBy: { table_number: 'asc' } });
  res.json(tables.map(toJson));
});

tablesRouter.get('/:number', async (req, res) => {
  res.json(toJson(await findOr404(parseId(req.params.number, 'table_number'))));
});

tablesRouter.post('/', async (req, res) => {
  const data = validate(req.body, createSchema);
  const table = await prisma.table.create({ data, include });
  res.status(201).json(toJson(table));
});

// Змінюється лише місткість; table_number у тілі ігнорується
tablesRouter.put('/:number', async (req, res) => {
  const number = parseId(req.params.number, 'table_number');
  const data = validate(req.body, updateSchema);
  await findOr404(number);
  const table = await prisma.table.update({ where: { table_number: number }, data, include });
  res.json(toJson(table));
});

// Видалення блокується, якщо на столик є бронювання або замовлення
tablesRouter.delete('/:number', async (req, res) => {
  const number = parseId(req.params.number, 'table_number');
  const { _count } = await findOr404(number);
  if (_count.reservations > 0 || _count.orders > 0) {
    throw conflict(
      `Неможливо видалити столик: на нього є бронювання (${_count.reservations}) ` +
        `або замовлення (${_count.orders})`,
    );
  }
  await prisma.table.delete({ where: { table_number: number } });
  res.status(204).end();
});
