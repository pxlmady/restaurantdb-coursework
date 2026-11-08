// CRUD бронювань (таблиця Reservation)
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { RESERVATION_STATUSES } from '../domain/dictionaries.js';
import { formatDateTime } from '../lib/format.js';
import { conflict, invalidField, notFound } from '../lib/http-error.js';
import { dateTime, integer, oneOf, parseId, validate } from '../lib/validation.js';

export const reservationsRouter = Router();

const MAX_INT = 2147483647;
const schema = {
  id_visitor: integer({ min: 1, max: MAX_INT }),
  table_number: integer({ min: 1, max: MAX_INT }),
  date_time: dateTime(),
  people_count: integer({ min: 1, max: 1000 }),
  // Як DEFAULT у базі (DF_Reservation_Status)
  reservation_status: oneOf({ values: RESERVATION_STATUSES, defaultValue: 'Активне' }),
};

const include = {
  visitor: true,
  table: true,
  order: { select: { id_order: true } },
};

const toJson = ({ visitor, table, order, date_time, ...reservation }) => ({
  ...reservation,
  date_time: formatDateTime(date_time),
  visitor: { full_name: visitor.full_name, phone_number: visitor.phone_number },
  table: { capacity: table.capacity },
  id_order: order?.id_order ?? null,
});

const findOr404 = async (id) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id_reservation: id },
    include,
  });
  if (!reservation) throw notFound(`Бронювання №${id} не знайдено`);
  return reservation;
};

// Перевірка пов'язаних записів і правила «кількість осіб не більша за місткість столика»
const checkReferences = async ({ id_visitor, table_number, people_count }) => {
  const visitor = await prisma.visitor.findUnique({ where: { id_visitor } });
  if (!visitor) throw invalidField('id_visitor', `Відвідувача №${id_visitor} не знайдено`);
  const table = await prisma.table.findUnique({ where: { table_number } });
  if (!table) throw invalidField('table_number', `Столик №${table_number} не знайдено`);
  if (people_count > table.capacity) {
    throw invalidField(
      'people_count',
      `Столик №${table_number} розрахований на ${table.capacity} осіб, а в бронюванні ${people_count}`,
    );
  }
};

// Фільтр ?without_order=true — бронювання, до яких ще немає замовлення (для форми замовлення)
reservationsRouter.get('/', async (req, res) => {
  const where = req.query.without_order === 'true' ? { order: { is: null } } : {};
  const reservations = await prisma.reservation.findMany({
    where,
    include,
    orderBy: [{ date_time: 'desc' }, { id_reservation: 'desc' }],
  });
  res.json(reservations.map(toJson));
});

reservationsRouter.get('/:id', async (req, res) => {
  res.json(toJson(await findOr404(parseId(req.params.id))));
});

reservationsRouter.post('/', async (req, res) => {
  const data = validate(req.body, schema);
  await checkReferences(data);
  const reservation = await prisma.reservation.create({ data, include });
  res.status(201).json(toJson(reservation));
});

reservationsRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, schema);
  const current = await findOr404(id);
  await checkReferences(data);
  // Столик замовлення береться з бронювання, тому після створення замовлення
  // столик бронювання змінювати не можна: інакше вони розійдуться
  if (current.order && data.table_number !== current.table_number) {
    throw conflict(
      `Неможливо змінити столик: за бронюванням уже є замовлення №${current.order.id_order}`,
      [{ field: 'table_number', message: 'Столик змінювати не можна: є замовлення' }],
    );
  }
  const reservation = await prisma.reservation.update({
    where: { id_reservation: id },
    data,
    include,
  });
  res.json(toJson(reservation));
});

// Видалення блокується, якщо за бронюванням є замовлення (FK_Order_Reservation)
reservationsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const { order } = await findOr404(id);
  if (order) {
    throw conflict(`Неможливо видалити бронювання: за ним є замовлення №${order.id_order}`);
  }
  await prisma.reservation.delete({ where: { id_reservation: id } });
  res.status(204).end();
});
