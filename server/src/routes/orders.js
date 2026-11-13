// CRUD замовлень (таблиця [Order]) і їхніх позицій (таблиця OrderDetail).
// Замовлення разом з позиціями створюється і змінюється в одній транзакції Prisma:
// якщо будь-яка перевірка чи вставка не вдалася, у базі не залишається нічого.
// Етап 9: у тій самій транзакції сервер визначає знижку (domain/discounts.js) і записує
// її відсоток у [Order].discount_percent. Клієнт відсоток не передає.
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { PAYMENT_STATUSES } from '../domain/dictionaries.js';
import {
  applyDiscount,
  detailsTotal,
  evaluateDiscount,
  isDiscountFrozen,
  refreshOrderDiscount,
} from '../domain/discounts.js';
import { formatDateTime, formatMoney } from '../lib/format.js';
import { conflict, HttpError, invalidField, notFound } from '../lib/http-error.js';
import { integer, money, oneOf, parseId, validate } from '../lib/validation.js';

export const ordersRouter = Router();

const MAX_INT = 2147483647;
const quantity = integer({ min: 1, max: 1000 });

const orderSchema = {
  // Бронювання необов'язкове: замовлення може бути без попереднього запису
  id_reservation: integer({ required: false, min: 1, max: MAX_INT }),
  id_waiter: integer({ min: 1, max: MAX_INT }),
  // Обов'язковий лише без бронювання; з бронюванням столик береться з нього
  table_number: integer({ required: false, min: 1, max: MAX_INT }),
  payment_status: oneOf({ values: PAYMENT_STATUSES }),
  // Як DEFAULT у базі (DF_Order_Tips)
  tips: money({ min: 0, defaultValue: '0' }),
};
const detailSchema = { id_dish: integer({ min: 1, max: MAX_INT }), quantity };

const include = {
  waiter: true,
  reservation: { include: { visitor: true } },
  order_details: { include: { dish: true }, orderBy: { id_dish: 'asc' } },
};

const detailToJson = ({ dish, ...detail }) => ({
  ...detail,
  dish: { title: dish.title, price: formatMoney(dish.price) },
  line_total: formatMoney(dish.price.mul(detail.quantity)),
});

// Сума замовлення не зберігається в базі: рахуємо за поточними цінами страв.
// Знижка: відсоток з бази, сума знижки й сума до сплати рахуються від суми позицій.
const toJson = ({ waiter, reservation, order_details, tips, discount_percent, ...order }) => {
  const total = detailsTotal(order_details);
  const { discount_amount, total_due } = applyDiscount(total, discount_percent);
  return {
    ...order,
    tips: formatMoney(tips),
    discount_percent: Number(discount_percent),
    waiter: { full_name: waiter.full_name },
    reservation: reservation && {
      date_time: formatDateTime(reservation.date_time),
      people_count: reservation.people_count,
      reservation_status: reservation.reservation_status,
      visitor: { id_visitor: reservation.id_visitor, full_name: reservation.visitor.full_name },
    },
    details: order_details.map(detailToJson),
    items_count: order_details.length,
    total: formatMoney(total),
    discount_amount: formatMoney(discount_amount),
    total_due: formatMoney(total_due),
  };
};

// Перевірка масиву позицій з тіла запиту: [{ id_dish, quantity }, ...]
const validateDetails = (list) => {
  if (!Array.isArray(list)) {
    throw invalidField('details', 'Очікується масив позицій [{ id_dish, quantity }]');
  }
  const details = [];
  const issues = [];
  list.forEach((item, index) => {
    try {
      details.push(validate(item, detailSchema));
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      issues.push(...err.details.map((d) => ({ ...d, field: `details[${index}].${d.field}` })));
    }
  });
  if (issues.length > 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Перевірте позиції замовлення', issues);
  }
  const ids = details.map((d) => d.id_dish);
  if (new Set(ids).size !== ids.length) {
    throw invalidField('details', 'Кожна страва може бути в замовленні лише один раз');
  }
  return details;
};

// Перевірки шапки замовлення в межах транзакції. Повертає дані для запису.
const resolveOrder = async (tx, data, orderId = null) => {
  const waiter = await tx.waiter.findUnique({ where: { id_waiter: data.id_waiter } });
  if (!waiter) throw invalidField('id_waiter', `Офіціанта №${data.id_waiter} не знайдено`);

  if (data.id_reservation !== null) {
    const reservation = await tx.reservation.findUnique({
      where: { id_reservation: data.id_reservation },
      include: { order: { select: { id_order: true } } },
    });
    if (!reservation) {
      throw invalidField('id_reservation', `Бронювання №${data.id_reservation} не знайдено`);
    }
    if (reservation.order && reservation.order.id_order !== orderId) {
      throw conflict(
        `Для бронювання №${data.id_reservation} вже є замовлення №${reservation.order.id_order}`,
        [{ field: 'id_reservation', message: 'Бронювання вже використане в іншому замовленні' }],
      );
    }
    // Правило курсової: столик замовлення береться з бронювання
    return { ...data, table_number: reservation.table_number };
  }

  if (data.table_number === null) {
    throw invalidField('table_number', 'Вкажіть столик (або виберіть бронювання)');
  }
  const table = await tx.table.findUnique({ where: { table_number: data.table_number } });
  if (!table) throw invalidField('table_number', `Столик №${data.table_number} не знайдено`);
  return data;
};

const checkDishes = async (tx, details) => {
  const ids = details.map((d) => d.id_dish);
  if (ids.length === 0) return;
  const found = await tx.dish.findMany({
    where: { id_dish: { in: ids } },
    select: { id_dish: true },
  });
  const known = new Set(found.map((d) => d.id_dish));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw invalidField('details', `Страв не знайдено: ${missing.map((id) => `№${id}`).join(', ')}`);
  }
};

const findOr404 = async (client, id) => {
  const order = await client.order.findUnique({ where: { id_order: id }, include });
  if (!order) throw notFound(`Замовлення №${id} не знайдено`);
  return order;
};

// ----- Попередній розрахунок знижки (для форми замовлення, у базі нічого не змінює) -----

// Тіло: { id_order?, id_reservation?, payment_status?, details: [{ id_dish, quantity }] }.
// Неповні позиції форми (без страви або з неправильною кількістю) пропускаються.
const previewSchema = {
  id_order: integer({ required: false, min: 1, max: MAX_INT }),
  id_reservation: integer({ required: false, min: 1, max: MAX_INT }),
  payment_status: oneOf({ values: PAYMENT_STATUSES, required: false }),
};

ordersRouter.post('/discount-preview', async (req, res) => {
  const data = validate(req.body, previewSchema);
  const lines = (Array.isArray(req.body.details) ? req.body.details : []).flatMap((item) => {
    try {
      return [validate(item, detailSchema)];
    } catch (err) {
      if (err instanceof HttpError) return [];
      throw err;
    }
  });
  const dishes = await prisma.dish.findMany({
    where: { id_dish: { in: lines.map((l) => l.id_dish) } },
  });
  const priceOf = new Map(dishes.map((d) => [d.id_dish, d]));
  const total = detailsTotal(
    lines
      .filter((l) => priceOf.has(l.id_dish))
      .map((l) => ({ ...l, dish: priceOf.get(l.id_dish) })),
  );

  const stored = data.id_order
    ? await prisma.order.findUnique({ where: { id_order: data.id_order } })
    : null;
  const evaluation = await evaluateDiscount(prisma, {
    id_order: stored?.id_order ?? null,
    id_reservation: data.id_reservation,
    total,
  });
  // Закрите замовлення, яке лишається закритим, зберігає свою знижку
  const frozen = Boolean(
    stored && isDiscountFrozen(stored.payment_status, data.payment_status ?? stored.payment_status),
  );
  const percent = frozen ? Number(stored.discount_percent) : evaluation.percent;
  const { discount_amount, total_due } = applyDiscount(total, percent);

  res.json({
    discount_percent: percent,
    applied: frozen ? null : evaluation.applied,
    frozen,
    rules: evaluation.rules,
    total: formatMoney(total),
    discount_amount: formatMoney(discount_amount),
    total_due: formatMoney(total_due),
  });
});

// ----- Замовлення -----

ordersRouter.get('/', async (_req, res) => {
  const orders = await prisma.order.findMany({ include, orderBy: { id_order: 'asc' } });
  res.json(orders.map(toJson));
});

ordersRouter.get('/:id', async (req, res) => {
  res.json(toJson(await findOr404(prisma, parseId(req.params.id))));
});

// Тіло: { id_reservation?, id_waiter, table_number?, payment_status, tips?, details?: [...] }
ordersRouter.post('/', async (req, res) => {
  const data = validate(req.body, orderSchema);
  const details = validateDetails(req.body.details ?? []);

  const order = await prisma.$transaction(async (tx) => {
    const orderData = await resolveOrder(tx, data);
    const created = await tx.order.create({ data: orderData });
    // Страви перевіряються вже після вставки замовлення: якщо якоїсь немає,
    // помилка скасовує всю транзакцію, і замовлення теж не зберігається
    await checkDishes(tx, details);
    if (details.length > 0) {
      await tx.orderDetail.createMany({
        data: details.map((d) => ({ ...d, id_order: created.id_order })),
      });
    }
    // Знижка нового замовлення визначається завжди, незалежно від статусу
    await refreshOrderDiscount(tx, created.id_order, { force: true });
    return findOr404(tx, created.id_order);
  });

  res.status(201).json(toJson(order));
});

// Якщо в тілі є details, позиції замовлення повністю замінюються в тій самій транзакції
ordersRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = validate(req.body, orderSchema);
  const details = req.body.details === undefined ? null : validateDetails(req.body.details);

  const order = await prisma.$transaction(async (tx) => {
    const stored = await findOr404(tx, id);
    const orderData = await resolveOrder(tx, data, id);
    await tx.order.update({ where: { id_order: id }, data: orderData });
    if (details) {
      await checkDishes(tx, details);
      await tx.orderDetail.deleteMany({ where: { id_order: id } });
      if (details.length > 0) {
        await tx.orderDetail.createMany({ data: details.map((d) => ({ ...d, id_order: id })) });
      }
    }
    // Закрите замовлення, яке лишається закритим, зберігає зафіксовану знижку
    if (!isDiscountFrozen(stored.payment_status, data.payment_status)) {
      await refreshOrderDiscount(tx, id, { force: true });
    }
    return findOr404(tx, id);
  });

  res.json(toJson(order));
});

// Позиції видаляються разом із замовленням (FK_OrderDetail_Order ON DELETE CASCADE)
ordersRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await findOr404(prisma, id);
  await prisma.order.delete({ where: { id_order: id } });
  res.status(204).end();
});

// ----- Позиції замовлення (OrderDetail, ключ id_order + id_dish) -----

const detailKey = (req) => ({
  id_order_id_dish: {
    id_order: parseId(req.params.id),
    id_dish: parseId(req.params.dishId, 'id_dish'),
  },
});

const findDetailOr404 = async (key) => {
  const detail = await prisma.orderDetail.findUnique({ where: key, include: { dish: true } });
  if (!detail) {
    const { id_order, id_dish } = key.id_order_id_dish;
    throw notFound(`У замовленні №${id_order} немає страви №${id_dish}`);
  }
  return detail;
};

ordersRouter.get('/:id/details', async (req, res) => {
  const order = await findOr404(prisma, parseId(req.params.id));
  res.json(order.order_details.map(detailToJson));
});

ordersRouter.post('/:id/details', async (req, res) => {
  const id_order = parseId(req.params.id);
  const data = validate(req.body, detailSchema);
  await findOr404(prisma, id_order);
  const dish = await prisma.dish.findUnique({ where: { id_dish: data.id_dish } });
  if (!dish) throw invalidField('id_dish', `Страву №${data.id_dish} не знайдено`);
  // Повторне додавання тієї самої страви відхиляє первинний ключ PK_OrderDetail (409).
  // Знижку замовлення «В очікуванні» перераховуємо в тій самій транзакції.
  const detail = await prisma.$transaction(async (tx) => {
    const created = await tx.orderDetail.create({
      data: { ...data, id_order },
      include: { dish: true },
    });
    await refreshOrderDiscount(tx, id_order);
    return created;
  });
  res.status(201).json(detailToJson(detail));
});

// Змінюється лише кількість; щоб замінити страву, видаліть позицію й додайте нову
ordersRouter.put('/:id/details/:dishId', async (req, res) => {
  const key = detailKey(req);
  const data = validate(req.body, { quantity });
  await findDetailOr404(key);
  const detail = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderDetail.update({ where: key, data, include: { dish: true } });
    await refreshOrderDiscount(tx, updated.id_order);
    return updated;
  });
  res.json(detailToJson(detail));
});

ordersRouter.delete('/:id/details/:dishId', async (req, res) => {
  const key = detailKey(req);
  await findDetailOr404(key);
  await prisma.$transaction(async (tx) => {
    await tx.orderDetail.delete({ where: key });
    await refreshOrderDiscount(tx, key.id_order_id_dish.id_order);
  });
  res.status(204).end();
});
