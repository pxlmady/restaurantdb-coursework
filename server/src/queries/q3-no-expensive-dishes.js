// Q3. Відвідувачі, які жодного разу не замовляли страв дорожчих за X грн (ціна ≥ X).
// Прототип: ЛР2 №5 і представлення vw_CustomersWithoutExpensiveProducts з ПР2.1:
// GROUP BY + HAVING SUM(CASE WHEN ціна >= X THEN 1 ELSE 0 END) = 0.
// Як і в прототипі, враховуються лише відвідувачі, які мають хоча б одне замовлення.
// Реалізація: параметризований SQL через Prisma $queryRaw.
import { prisma } from '../lib/prisma.js';
import { runSql } from '../lib/named-sql.js';
import { money as moneyRule, validate } from '../lib/validation.js';
import { money, showParams } from './common.js';

const schema = { price: moneyRule({ defaultValue: '200' }) };

const SQL = `SELECT v.id_visitor, v.full_name, v.phone_number,
       COUNT(DISTINCT o.id_order) AS orders_count,
       MAX(d.price)               AS max_price
FROM Visitor AS v
JOIN Reservation AS r  ON r.id_visitor = v.id_visitor
JOIN [Order] AS o      ON o.id_reservation = r.id_reservation
JOIN OrderDetail AS od ON od.id_order = o.id_order
JOIN Dish AS d         ON d.id_dish = od.id_dish
GROUP BY v.id_visitor, v.full_name, v.phone_number
HAVING SUM(CASE WHEN d.price >= @price THEN 1 ELSE 0 END) = 0
ORDER BY v.full_name DESC;`;

// Скільки всього відвідувачів із замовленнями (для підсумку «X з Y»)
const SQL_TOTAL = `SELECT COUNT(DISTINCT r.id_visitor) AS visitors_with_orders
FROM Reservation AS r
JOIN [Order] AS o ON o.id_reservation = r.id_reservation;`;

export async function noExpensiveDishes(query) {
  const params = validate(query, schema);
  const [result, [total]] = await Promise.all([
    runSql(prisma, SQL, params),
    runSql(prisma, SQL_TOTAL, {}),
  ]);

  const rows = result.map((row) => ({
    id_visitor: row.id_visitor,
    full_name: row.full_name,
    phone_number: row.phone_number,
    orders_count: row.orders_count,
    max_price: money(row.max_price),
  }));

  return {
    params,
    rows,
    summary: {
      visitors_count: rows.length,
      visitors_with_orders: total.visitors_with_orders,
      price: money(params.price),
    },
    sql: [{ title: 'SQL (Prisma $queryRaw)', text: SQL, params: showParams(params) }],
  };
}
