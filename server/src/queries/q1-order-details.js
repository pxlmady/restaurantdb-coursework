// Q1. Деталізація замовлень: клієнт, офіціант, столик, страва, кількість, сума + разом.
// Прототип: ПР1, practice1/SQLQuery3.sql (JOIN 6 таблиць). Там INNER JOIN з Reservation і Visitor
// відкидав замовлення без бронювання, тому тут бронювання й відвідувач приєднуються через LEFT JOIN.
// Реалізація: Prisma findMany (ORM сама будує JOIN, необов'язковий зв'язок = LEFT JOIN).
import { prisma } from '../lib/prisma.js';
import { formatDateTime, formatMoney } from '../lib/format.js';
import { integer, validate } from '../lib/validation.js';
import { MAX_INT, paymentStatus, sumBy } from './common.js';

const schema = {
  payment_status: paymentStatus,
  id_waiter: integer({ required: false, min: 1, max: MAX_INT }),
  table_number: integer({ required: false, min: 1, max: MAX_INT }),
};

const SQL = `SELECT o.id_order, v.full_name AS visitor, w.full_name AS waiter, o.table_number,
       d.title AS dish, d.price, od.quantity, od.quantity * d.price AS line_total
FROM [Order] AS o
LEFT JOIN Reservation AS r ON r.id_reservation = o.id_reservation
LEFT JOIN Visitor AS v     ON v.id_visitor = r.id_visitor
JOIN Waiter AS w           ON w.id_waiter = o.id_waiter
JOIN OrderDetail AS od     ON od.id_order = o.id_order
JOIN Dish AS d             ON d.id_dish = od.id_dish
WHERE (@payment_status IS NULL OR o.payment_status = @payment_status)
  AND (@id_waiter IS NULL OR o.id_waiter = @id_waiter)
  AND (@table_number IS NULL OR o.table_number = @table_number)
ORDER BY o.id_order, d.title;`;

export async function orderDetails(query) {
  const params = validate(query, schema);
  // Умови лише для заданих фільтрів
  const where = {
    order: {
      ...(params.payment_status && { payment_status: params.payment_status }),
      ...(params.id_waiter && { id_waiter: params.id_waiter }),
      ...(params.table_number && { table_number: params.table_number }),
    },
  };
  const details = await prisma.orderDetail.findMany({
    where,
    include: {
      dish: true,
      order: { include: { waiter: true, reservation: { include: { visitor: true } } } },
    },
    orderBy: [{ id_order: 'asc' }, { dish: { title: 'asc' } }],
  });

  const rows = details.map(({ order, dish, quantity }) => ({
    id_order: order.id_order,
    visitor: order.reservation?.visitor.full_name ?? null,
    reservation_date_time: order.reservation ? formatDateTime(order.reservation.date_time) : null,
    waiter: order.waiter.full_name,
    table_number: order.table_number,
    payment_status: order.payment_status,
    dish: dish.title,
    price: formatMoney(dish.price),
    quantity,
    line_total: formatMoney(dish.price.mul(quantity)),
  }));

  return {
    params,
    rows,
    summary: {
      orders_count: new Set(rows.map((row) => row.id_order)).size,
      lines_count: rows.length,
      portions: rows.reduce((sum, row) => sum + row.quantity, 0),
      total: formatMoney(sumBy(rows, (row) => row.line_total)),
    },
    sql: [
      {
        title: 'Еквівалентний SQL (запит будує Prisma: orderDetail.findMany з include)',
        text: SQL,
      },
    ],
  };
}
