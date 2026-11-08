// CRUD страв меню (таблиця Dish)
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { formatMoney } from '../lib/format.js';
import { conflict, notFound } from '../lib/http-error.js';
import { integer, money, parseId, text, validate } from '../lib/validation.js';

export const dishesRouter = Router();

const schema = {
  title: text({ max: 100 }),
  price: money({ min: 0 }),
  weight_grams: integer({ min: 1, max: 100000 }),
};

const include = { _count: { select: { order_details: true } } };

const toJson = ({ _count, price, ...dish }) => ({
  ...dish,
  price: formatMoney(price),
  order_details_count: _count.order_details,
});

const findOr404 = async (id) => {
  const dish = await prisma.dish.findUnique({ where: { id_dish: id }, include });
  if (!dish) throw notFound(`Страву №${id} не знайдено`);
  return dish;
};

dishesRouter.get('/', async (_req, res) => {
  const dishes = await prisma.dish.findMany({ include, orderBy: { id_dish: 'asc' } });
  res.json(dishes.map(toJson));
});

dishesRouter.get('/:id', async (req, res) => {
  res.json(toJson(await findOr404(parseId(req.params.id))));
});

dishesRouter.post('/', async (req, res) => {
  const data = validate(req.body, schema);
  const dish = await prisma.dish.create({ data, include });
  res.status(201).json(toJson(dish));
});

dishesRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, schema);
  await findOr404(id);
  const dish = await prisma.dish.update({ where: { id_dish: id }, data, include });
  res.json(toJson(dish));
});

// Видалення блокується, якщо страва є в замовленнях (FK_OrderDetail_Dish)
dishesRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { _count } = await findOr404(id);
  if (_count.order_details > 0) {
    throw conflict(
      `Неможливо видалити страву: вона є в замовленнях (${_count.order_details} позицій)`,
    );
  }
  await prisma.dish.delete({ where: { id_dish: id } });
  res.status(204).end();
});
