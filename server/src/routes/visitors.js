// CRUD відвідувачів (таблиця Visitor)
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/http-error.js';
import { parseId, text, validate } from '../lib/validation.js';

export const visitorsRouter = Router();

const schema = {
  full_name: text({ max: 100 }),
  phone_number: text({
    max: 20,
    pattern: /^\+?[0-9][0-9 ()-]{4,19}$/,
    patternMessage: 'Телефон: цифри, пробіли, дужки, дефіс; можна з + на початку',
  }),
};

const toJson = ({ _count, ...visitor }) => ({
  ...visitor,
  reservations_count: _count.reservations,
});

const include = { _count: { select: { reservations: true } } };

const findOr404 = async (id) => {
  const visitor = await prisma.visitor.findUnique({ where: { id_visitor: id }, include });
  if (!visitor) throw notFound(`Відвідувача №${id} не знайдено`);
  return visitor;
};

visitorsRouter.get('/', async (_req, res) => {
  const visitors = await prisma.visitor.findMany({ include, orderBy: { id_visitor: 'asc' } });
  res.json(visitors.map(toJson));
});

visitorsRouter.get('/:id', async (req, res) => {
  res.json(toJson(await findOr404(parseId(req.params.id))));
});

visitorsRouter.post('/', async (req, res) => {
  const data = validate(req.body, schema);
  const visitor = await prisma.visitor.create({ data, include });
  res.status(201).json(toJson(visitor));
});

visitorsRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, schema);
  await findOr404(id);
  const visitor = await prisma.visitor.update({ where: { id_visitor: id }, data, include });
  res.json(toJson(visitor));
});

// Видалення блокується, якщо є бронювання (FK_Reservation_Visitor, ON DELETE NO ACTION)
visitorsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const visitor = await findOr404(id);
  if (visitor._count.reservations > 0) {
    throw conflict(
      `Неможливо видалити відвідувача: у нього є бронювання (${visitor._count.reservations})`,
    );
  }
  await prisma.visitor.delete({ where: { id_visitor: id } });
  res.status(204).end();
});
