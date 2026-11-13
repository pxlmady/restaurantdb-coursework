// Q2. Витрати відвідувачів: кількість замовлень, сума, середній і найбільший чек на кожного.
// Прототип: ЛР2 №4 (скільки сплатила кожна компанія: JOIN + SUM + GROUP BY).
// Відвідувач пов'язаний із замовленням лише через бронювання, тому замовлення без бронювання
// (гості без запису) тут не враховуються. Період — за датою бронювання.
// Етап 9: суми рахуються з урахуванням знижки замовлення ([Order].discount_percent), тобто
// «витрачено» = сума до сплати (без чайових).
// Реалізація: параметризований SQL через Prisma $queryRaw (CTE, GROUP BY, HAVING).
import { prisma } from '../lib/prisma.js';
import { runSql } from '../lib/named-sql.js';
import { date, money as moneyRule, validate } from '../lib/validation.js';
import { checkPeriod, money, nextDay, paymentStatus, showParams, sumBy } from './common.js';

const schema = {
  from: date({ required: false }),
  to: date({ required: false }),
  payment_status: paymentStatus,
  min_total: moneyRule({ required: false }),
};

// Спершу сума до сплати кожного замовлення (CTE), потім групування замовлень за відвідувачем
const SQL = `WITH order_totals AS (
    SELECT o.id_order, r.id_visitor,
           SUM(od.quantity * d.price)
             - ROUND(SUM(od.quantity * d.price) * o.discount_percent / 100, 2) AS order_total
    FROM [Order] AS o
    JOIN Reservation AS r  ON r.id_reservation = o.id_reservation
    JOIN OrderDetail AS od ON od.id_order = o.id_order
    JOIN Dish AS d         ON d.id_dish = od.id_dish
    WHERE (@payment_status IS NULL OR o.payment_status = @payment_status)
      AND (@from IS NULL OR r.date_time >= @from)
      AND (@to_next_day IS NULL OR r.date_time < @to_next_day)
    GROUP BY o.id_order, r.id_visitor, o.discount_percent
)
SELECT v.id_visitor, v.full_name, v.phone_number,
       COUNT(*)              AS orders_count,
       SUM(t.order_total)    AS total_spent,
       AVG(t.order_total)    AS avg_check,
       MAX(t.order_total)    AS max_check
FROM Visitor AS v
JOIN order_totals AS t ON t.id_visitor = v.id_visitor
GROUP BY v.id_visitor, v.full_name, v.phone_number
HAVING (@min_total IS NULL OR SUM(t.order_total) >= @min_total)
ORDER BY total_spent DESC, v.full_name;`;

export async function visitorSpending(query) {
  const params = validate(query, schema);
  checkPeriod(params.from, params.to);
  const sqlParams = {
    payment_status: params.payment_status,
    from: params.from,
    to_next_day: nextDay(params.to),
    min_total: params.min_total,
  };
  const result = await runSql(prisma, SQL, sqlParams);

  const rows = result.map((row) => ({
    id_visitor: row.id_visitor,
    full_name: row.full_name,
    phone_number: row.phone_number,
    orders_count: row.orders_count,
    total_spent: money(row.total_spent),
    avg_check: money(row.avg_check),
    max_check: money(row.max_check),
  }));

  return {
    params,
    rows,
    summary: {
      visitors_count: rows.length,
      orders_count: rows.reduce((sum, row) => sum + row.orders_count, 0),
      total: money(sumBy(rows, (row) => row.total_spent)),
    },
    sql: [{ title: 'SQL (Prisma $queryRaw)', text: SQL, params: showParams(sqlParams) }],
  };
}
