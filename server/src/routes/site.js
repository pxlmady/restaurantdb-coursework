// API сайту ресторану для відвідувачів (етап 10): /api/site/...
// Відвідувач не працює з ідентифікаторами: він вказує ім'я, телефон, час і кількість осіб,
// а сервер сам знаходить або створює запис Visitor, підбирає найменший вільний столик
// (той самий SQL, що й у запиті Q8) і, якщо є передзамовлення, створює замовлення
// «В очікуванні» з офіціантом і знижкою (правила етапу 9). Усе це — одна транзакція Prisma.
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  applyDiscount,
  detailsTotal,
  DISCOUNT_RULES,
  evaluateDiscount,
  PENDING_STATUS,
  refreshOrderDiscount,
} from '../domain/discounts.js';
import { nowAsStored, SITE_RULES } from '../domain/site.js';
import { formatDateTime, formatMoney } from '../lib/format.js';
import { conflict, HttpError, invalidField, notFound } from '../lib/http-error.js';
import { runSql } from '../lib/named-sql.js';
import { dateTime, integer, parseId, text, validate } from '../lib/validation.js';
import { FREE_TABLES_SQL } from '../queries/q8-free-tables.js';

export const siteRouter = Router();

const MAX_INT = 2147483647;
const ACTIVE = 'Активне';
const CANCELLED = 'Скасоване';
const ORDER_CANCELLED = 'Скасовано';
const HOUR = 60 * 60 * 1000;

// ----- Перевірка введених даних -----

// Телефон на сайті — лише український мобільний формат +380XXXXXXXXX. Пробіли, дужки й дефіси
// прибираємо, щоб той самий номер, записаний по-різному, знаходив того самого відвідувача
const normalizePhone = (value) =>
  typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value;
const phone = text({
  max: 20,
  pattern: /^\+380\d{9}$/,
  patternMessage: 'Телефон у форматі +380XXXXXXXXX (9 цифр після +380)',
});
const withPhone = (body) =>
  body && typeof body === 'object' && !Array.isArray(body)
    ? { ...body, phone_number: normalizePhone(body.phone_number) }
    : body;

const bookingSchema = {
  full_name: text({ max: 100 }),
  phone_number: phone,
  date_time: dateTime(),
  people_count: integer({ min: 1, max: 1000 }),
};
const slotSchema = { date_time: bookingSchema.date_time, people_count: bookingSchema.people_count };
const detailSchema = {
  id_dish: integer({ min: 1, max: MAX_INT }),
  quantity: integer({ min: 1, max: SITE_RULES.max_quantity }),
};

const pad = (n) => String(n).padStart(2, '0');
const hoursText = `з ${pad(SITE_RULES.open_hour)}:00 до ${pad(SITE_RULES.last_booking_hour)}:00`;

// Час бронювання: у майбутньому і в межах годин, коли приймаються бронювання
const checkSlot = (date_time) => {
  if (date_time <= nowAsStored()) {
    throw invalidField('date_time', 'Цей час уже минув. Оберіть час у майбутньому');
  }
  const minutes = date_time.getUTCHours() * 60 + date_time.getUTCMinutes();
  if (minutes < SITE_RULES.open_hour * 60 || minutes > SITE_RULES.last_booking_hour * 60) {
    throw invalidField(
      'date_time',
      `Бронювання приймаються на час ${hoursText} (ресторан працює до ${pad(SITE_RULES.close_hour)}:00)`,
    );
  }
};

// Позиції передзамовлення: [{ id_dish, quantity }]; порожній масив — бронювання без страв
const validateDetails = (list) => {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) {
    throw invalidField('details', 'Очікується масив позицій [{ id_dish, quantity }]');
  }
  if (list.length > SITE_RULES.max_preorder_lines) {
    throw invalidField(
      'details',
      `У передзамовленні не більше ${SITE_RULES.max_preorder_lines} страв`,
    );
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
    throw new HttpError(400, 'VALIDATION_ERROR', 'Перевірте позиції передзамовлення', issues);
  }
  const ids = details.map((d) => d.id_dish);
  if (new Set(ids).size !== ids.length) {
    throw invalidField('details', 'Кожна страва може бути в передзамовленні лише один раз');
  }
  return details;
};

// ----- Спільні дії з базою (client — prisma або tx) -----

// Найменший вільний столик на цей час: перший рядок запиту Q8 (сортування за місткістю)
const findFreeTable = async (client, { date_time, people_count }) => {
  const rows = await runSql(client, FREE_TABLES_SQL, {
    date_time,
    people_count,
    hours: SITE_RULES.reservation_hours,
  });
  return rows[0] ?? null;
};

const maxCapacity = async (client) =>
  (await client.table.aggregate({ _max: { capacity: true } }))._max.capacity ?? 0;

// Страви передзамовлення з цінами; невідома страва — помилка поля details
const loadDishes = async (client, details) => {
  const dishes = await client.dish.findMany({
    where: { id_dish: { in: details.map((d) => d.id_dish) } },
  });
  const byId = new Map(dishes.map((d) => [d.id_dish, d]));
  const missing = details.filter((d) => !byId.has(d.id_dish));
  if (missing.length > 0) {
    throw invalidField(
      'details',
      `Страв не знайдено: ${missing.map((d) => `№${d.id_dish}`).join(', ')}. Оновіть сторінку меню`,
    );
  }
  return details.map((d) => ({ ...d, dish: byId.get(d.id_dish) }));
};

// Офіціант для передзамовлення: той, у кого зараз найменше замовлень «В очікуванні»
const pickWaiter = async (client) => {
  const waiters = await client.waiter.findMany({
    include: { _count: { select: { orders: { where: { payment_status: PENDING_STATUS } } } } },
    orderBy: { id_waiter: 'asc' },
  });
  if (waiters.length === 0) {
    throw conflict('Передзамовлення зараз недоступне: у ресторані немає жодного офіціанта');
  }
  return waiters.reduce((best, w) => (w._count.orders < best._count.orders ? w : best));
};

// ----- Відповіді -----

const bookingInclude = {
  table: true,
  visitor: true,
  order: {
    include: {
      waiter: true,
      order_details: { include: { dish: true }, orderBy: { id_dish: 'asc' } },
    },
  },
};

const orderToJson = (order) => {
  if (!order) return null;
  const total = detailsTotal(order.order_details);
  const { discount_amount, total_due } = applyDiscount(total, order.discount_percent);
  return {
    id_order: order.id_order,
    payment_status: order.payment_status,
    waiter: order.waiter.full_name,
    details: order.order_details.map((d) => ({
      id_dish: d.id_dish,
      title: d.dish.title,
      price: formatMoney(d.dish.price),
      quantity: d.quantity,
      line_total: formatMoney(d.dish.price.mul(d.quantity)),
    })),
    total: formatMoney(total),
    discount_percent: Number(order.discount_percent),
    discount_amount: formatMoney(discount_amount),
    total_due: formatMoney(total_due),
  };
};

const bookingToJson = (reservation, now = nowAsStored()) => ({
  id_reservation: reservation.id_reservation,
  date_time: formatDateTime(reservation.date_time),
  people_count: reservation.people_count,
  reservation_status: reservation.reservation_status,
  table_number: reservation.table_number,
  table_capacity: reservation.table.capacity,
  // Скасувати можна лише активне бронювання, час якого ще не настав
  can_cancel: reservation.reservation_status === ACTIVE && reservation.date_time > now,
  visitor: {
    full_name: reservation.visitor.full_name,
    phone_number: reservation.visitor.phone_number,
  },
  order: orderToJson(reservation.order),
});

// ----- Маршрути -----

// Довідкова інформація для сторінок сайту: години роботи, найбільша компанія, правила знижок
siteRouter.get('/info', async (_req, res) => {
  const [capacity, tables] = await Promise.all([maxCapacity(prisma), prisma.table.count()]);
  res.json({
    rules: SITE_RULES,
    max_people: capacity,
    tables_count: tables,
    discount_rules: DISCOUNT_RULES,
  });
});

// Меню: усі страви; popular — три страви, яких замовлено найбільше порцій (GROUP BY + SUM)
siteRouter.get('/menu', async (_req, res) => {
  const [dishes, sold] = await Promise.all([
    prisma.dish.findMany({ orderBy: { id_dish: 'asc' } }),
    prisma.orderDetail.groupBy({
      by: ['id_dish'],
      _sum: { quantity: true },
      orderBy: [{ _sum: { quantity: 'desc' } }, { id_dish: 'asc' }],
      take: 3,
    }),
  ]);
  const popular = new Set(sold.map((row) => row.id_dish));
  res.json(
    dishes.map((dish) => ({
      id_dish: dish.id_dish,
      title: dish.title,
      price: formatMoney(dish.price),
      weight_grams: dish.weight_grams,
      popular: popular.has(dish.id_dish),
    })),
  );
});

// Чи є вільний столик: GET /api/site/availability?date_time=2026-11-20T19:00&people_count=2
siteRouter.get('/availability', async (req, res) => {
  const slot = validate(req.query, slotSchema);
  checkSlot(slot.date_time);
  const [table, capacity] = await Promise.all([findFreeTable(prisma, slot), maxCapacity(prisma)]);
  res.json({
    date_time: formatDateTime(slot.date_time),
    people_count: slot.people_count,
    available: Boolean(table),
    table: table && { table_number: table.table_number, capacity: table.capacity },
    // Чому столика немає: компанія більша за найбільший столик або все зайнято на цей час
    reason: table ? null : slot.people_count > capacity ? 'too_many_people' : 'no_free_tables',
    max_people: capacity,
  });
});

// Попередній розрахунок передзамовлення (у базі нічого не змінює).
// Тіло: { phone_number?, details: [{ id_dish, quantity }] }. За телефоном шукаємо відвідувача,
// щоб показати знижку постійного відвідувача ще до оформлення бронювання.
siteRouter.post('/preview', async (req, res) => {
  const body = withPhone(req.body);
  const { phone_number } = validate(body, { phone_number: text({ required: false, max: 20 }) });
  const lines = await loadDishes(prisma, validateDetails(body.details));
  const total = detailsTotal(lines);
  const visitor = phone_number
    ? await prisma.visitor.findUnique({ where: { phone_number } })
    : null;
  const evaluation = await evaluateDiscount(prisma, {
    id_visitor: visitor?.id_visitor ?? null,
    total,
  });
  const { discount_amount, total_due } = applyDiscount(total, evaluation.percent);
  res.json({
    known_visitor: Boolean(visitor),
    total: formatMoney(total),
    discount_percent: evaluation.percent,
    applied: evaluation.applied,
    rules: evaluation.rules,
    discount_amount: formatMoney(discount_amount),
    total_due: formatMoney(total_due),
  });
});

// Одна спроба бронювання в транзакції. Рівень SERIALIZABLE: між перевіркою «столик вільний»
// і вставкою бронювання ніхто інший не може зайняти той самий столик на цей час.
const createBooking = (data, details) =>
  prisma.$transaction(
    async (tx) => {
      // 1. Відвідувач: шукаємо за телефоном (UQ_Visitor_Phone), якщо немає — створюємо.
      //    Ім'я наявного відвідувача не перезаписуємо.
      let visitor = await tx.visitor.findUnique({ where: { phone_number: data.phone_number } });
      const isNew = !visitor;
      if (!visitor) {
        visitor = await tx.visitor.create({
          data: { full_name: data.full_name, phone_number: data.phone_number },
        });
      }

      // 2. Той самий відвідувач не може мати два бронювання на один час
      const own = await tx.reservation.findFirst({
        where: {
          id_visitor: visitor.id_visitor,
          reservation_status: { not: CANCELLED },
          date_time: {
            gt: new Date(data.date_time.getTime() - SITE_RULES.reservation_hours * HOUR),
            lt: new Date(data.date_time.getTime() + SITE_RULES.reservation_hours * HOUR),
          },
        },
      });
      if (own) {
        const [day, time] = formatDateTime(own.date_time).split('T');
        throw conflict(
          `На цей номер телефону вже є бронювання №${own.id_reservation} на ` +
            `${day.split('-').reverse().join('.')} ${time}. Перегляньте його в розділі «Мої бронювання»`,
          [{ field: 'date_time', message: 'У вас уже є бронювання на цей час' }],
        );
      }

      // 3. Столик: найменший вільний, що вміщує компанію (SQL запиту Q8)
      const table = await findFreeTable(tx, data);
      if (!table) {
        const capacity = await maxCapacity(tx);
        const message =
          data.people_count > capacity
            ? `Найбільший столик розрахований на ${capacity} осіб. Для більшої компанії зателефонуйте нам`
            : 'На цей час вільних столиків для такої компанії немає. Оберіть інший час';
        const field = data.people_count > capacity ? 'people_count' : 'date_time';
        throw conflict(message, [{ field, message }]);
      }

      // 4. Бронювання
      const reservation = await tx.reservation.create({
        data: {
          id_visitor: visitor.id_visitor,
          table_number: table.table_number,
          date_time: data.date_time,
          people_count: data.people_count,
          reservation_status: ACTIVE,
        },
      });

      // 5. Передзамовлення: замовлення «В очікуванні» з позиціями і знижкою (етап 9)
      if (details.length > 0) {
        await loadDishes(tx, details);
        const waiter = await pickWaiter(tx);
        const order = await tx.order.create({
          data: {
            id_reservation: reservation.id_reservation,
            id_waiter: waiter.id_waiter,
            table_number: table.table_number,
            payment_status: PENDING_STATUS,
          },
        });
        await tx.orderDetail.createMany({
          data: details.map((d) => ({ ...d, id_order: order.id_order })),
        });
        await refreshOrderDiscount(tx, order.id_order, { force: true });
      }

      const saved = await tx.reservation.findUnique({
        where: { id_reservation: reservation.id_reservation },
        include: bookingInclude,
      });
      return { ...bookingToJson(saved), visitor_is_new: isNew };
    },
    // maxWait — скільки чекати вільного з'єднання з пулу, коли бронювань одночасно багато
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10000,
      timeout: 15000,
    },
  );

// Дві одночасні транзакції SERIALIZABLE можуть заблокувати одна одну: SQL Server тоді
// скасовує одну з них (deadlock, помилка 1205). Скасовану спробу просто повторюємо.
const isRetryable = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError
    ? err.code === 'P2034'
    : /deadlock|1205/i.test(String(err?.message ?? ''));

const MAX_ATTEMPTS = 5;

// Бронювання столика. Тіло:
// { full_name, phone_number, date_time, people_count, details?: [{ id_dish, quantity }] }
siteRouter.post('/bookings', async (req, res) => {
  const data = validate(withPhone(req.body), bookingSchema);
  const details = validateDetails(req.body.details);
  checkSlot(data.date_time);

  for (let attempt = 1; ; attempt += 1) {
    try {
      res.status(201).json(await createBooking(data, details));
      return;
    } catch (err) {
      if (!isRetryable(err)) throw err;
      if (attempt === MAX_ATTEMPTS) {
        throw conflict('Зараз багато бронювань на цей час. Спробуйте ще раз за кілька секунд');
      }
      // Невелика випадкова пауза, щоб повторні спроби не зіткнулися знову
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));
    }
  }
});

// «Мої бронювання»: GET /api/site/bookings?phone_number=+380930000101
siteRouter.get('/bookings', async (req, res) => {
  const { phone_number } = validate(withPhone(req.query), { phone_number: phone });
  const visitor = await prisma.visitor.findUnique({ where: { phone_number } });
  if (!visitor) {
    res.json({ visitor: null, bookings: [] });
    return;
  }
  const reservations = await prisma.reservation.findMany({
    where: { id_visitor: visitor.id_visitor },
    include: bookingInclude,
    orderBy: [{ date_time: 'desc' }, { id_reservation: 'desc' }],
  });
  const now = nowAsStored();
  res.json({
    visitor: { full_name: visitor.full_name, phone_number: visitor.phone_number },
    bookings: reservations.map((r) => bookingToJson(r, now)),
  });
});

// Скасування бронювання відвідувачем: POST /api/site/bookings/:id/cancel { phone_number }.
// Записи не видаляються: бронювання стає «Скасоване», а його передзамовлення — «Скасовано».
siteRouter.post('/bookings/:id/cancel', async (req, res) => {
  const id = parseId(req.params.id);
  const { phone_number } = validate(withPhone(req.body), { phone_number: phone });

  const booking = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id_reservation: id },
      include: { visitor: true, order: true },
    });
    // Чуже бронювання не показуємо: відповідь така сама, як для неіснуючого
    if (!reservation || reservation.visitor.phone_number !== phone_number) {
      throw notFound(`Бронювання №${id} на цей номер телефону не знайдено`);
    }
    if (reservation.reservation_status !== ACTIVE) {
      throw conflict(`Бронювання №${id} уже має статус «${reservation.reservation_status}»`);
    }
    if (reservation.date_time <= nowAsStored()) {
      throw conflict(`Час бронювання №${id} уже настав, скасувати його на сайті не можна`);
    }
    if (reservation.order && reservation.order.payment_status !== PENDING_STATUS) {
      throw conflict(
        `За бронюванням №${id} є замовлення зі статусом «${reservation.order.payment_status}». ` +
          'Зверніться до адміністратора',
      );
    }
    await tx.reservation.update({
      where: { id_reservation: id },
      data: { reservation_status: CANCELLED },
    });
    if (reservation.order) {
      // Знижка фіксується в момент закриття замовлення (правило етапу 9)
      await refreshOrderDiscount(tx, reservation.order.id_order, { force: true });
      await tx.order.update({
        where: { id_order: reservation.order.id_order },
        data: { payment_status: ORDER_CANCELLED },
      });
    }
    return tx.reservation.findUnique({ where: { id_reservation: id }, include: bookingInclude });
  });

  res.json(bookingToJson(booking));
});
