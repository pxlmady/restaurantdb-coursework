// Q4. Записи без пов'язаних даних (антиз'єднання), три режими:
//   visitors_without_reservations — відвідувачі без жодного бронювання (ЛР2 №7: NOT EXISTS);
//   visitors_without_orders       — відвідувачі, за бронюваннями яких немає замовлень (ЛР2 №6);
//   dishes_not_ordered            — страви, яких немає в жодному замовленні (ЛР2 №7, варіант EXCEPT).
// Реалізація: параметризований SQL через Prisma $queryRaw.
import { prisma } from '../lib/prisma.js';
import { runSql } from '../lib/named-sql.js';
import { oneOf, validate } from '../lib/validation.js';
import { formatMoney } from '../lib/format.js';

export const Q4_MODES = [
  'visitors_without_reservations',
  'visitors_without_orders',
  'dishes_not_ordered',
];

const schema = { mode: oneOf({ values: Q4_MODES, defaultValue: Q4_MODES[0] }) };

const QUERIES = {
  visitors_without_reservations: {
    sql: `SELECT v.id_visitor, v.full_name, v.phone_number
FROM Visitor AS v
WHERE NOT EXISTS (
    SELECT 1
    FROM Reservation AS r
    WHERE r.id_visitor = v.id_visitor
)
ORDER BY v.full_name;`,
    total: 'SELECT COUNT(*) AS total FROM Visitor;',
  },
  visitors_without_orders: {
    // Відвідувач може мати бронювання (наприклад, скасовані), але жодного замовлення
    sql: `SELECT v.id_visitor, v.full_name, v.phone_number,
       (SELECT COUNT(*) FROM Reservation AS r2 WHERE r2.id_visitor = v.id_visitor) AS reservations_count
FROM Visitor AS v
WHERE NOT EXISTS (
    SELECT 1
    FROM Reservation AS r
    JOIN [Order] AS o ON o.id_reservation = r.id_reservation
    WHERE r.id_visitor = v.id_visitor
)
ORDER BY v.full_name;`,
    total: 'SELECT COUNT(*) AS total FROM Visitor;',
  },
  dishes_not_ordered: {
    // EXCEPT дає ідентифікатори страв, яких немає в OrderDetail; далі беремо їхні дані
    sql: `SELECT d.id_dish, d.title, d.price, d.weight_grams
FROM Dish AS d
WHERE d.id_dish IN (
    SELECT id_dish FROM Dish
    EXCEPT
    SELECT id_dish FROM OrderDetail
)
ORDER BY d.title;`,
    total: 'SELECT COUNT(*) AS total FROM Dish;',
  },
};

export async function withoutActivity(query) {
  const params = validate(query, schema);
  const { sql, total } = QUERIES[params.mode];
  const [result, [count]] = await Promise.all([runSql(prisma, sql, {}), runSql(prisma, total, {})]);
  const rows = result.map((row) =>
    'price' in row ? { ...row, price: formatMoney(row.price) } : row,
  );
  return {
    params,
    rows,
    summary: { found: rows.length, total: count.total },
    sql: [{ title: 'SQL (Prisma $queryRaw)', text: sql }],
  };
}
