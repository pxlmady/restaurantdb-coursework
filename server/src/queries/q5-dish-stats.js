// Q5. Статистика страв: у скількох замовленнях, усього порцій, найбільше порцій в одному
// замовленні, виручка, частка у виручці та місце в рейтингу.
// Прототип: ЛР2 №3 (MAX знижки на товар: GROUP BY і варіант MAX() OVER (PARTITION BY)).
// Тут GROUP BY рахує показники страви, а віконні функції — частку від загальної виручки
// (SUM(SUM(...)) OVER ()) і рейтинг (RANK() OVER). LEFT JOIN залишає страви без замовлень з нулями.
// Реалізація: параметризований SQL через Prisma $queryRaw.
import { prisma } from '../lib/prisma.js';
import { runSql } from '../lib/named-sql.js';
import { integer, validate } from '../lib/validation.js';
import { money, paymentStatus, showParams, sumBy } from './common.js';

const schema = {
  payment_status: paymentStatus,
  min_portions: integer({ required: false, min: 0, max: 1000000 }),
};

const SQL = `WITH order_lines AS (
    SELECT od.id_dish, od.id_order, od.quantity
    FROM OrderDetail AS od
    JOIN [Order] AS o ON o.id_order = od.id_order
    WHERE (@payment_status IS NULL OR o.payment_status = @payment_status)
),
dish_stats AS (
    SELECT d.id_dish, d.title, d.price,
           COUNT(l.id_order)                 AS orders_count,
           COALESCE(SUM(l.quantity), 0)      AS portions,
           COALESCE(MAX(l.quantity), 0)      AS max_in_order,
           COALESCE(SUM(l.quantity), 0) * d.price AS revenue,
           -- віконна функція поверх групування: загальна виручка всіх страв
           SUM(COALESCE(SUM(l.quantity), 0) * d.price) OVER () AS revenue_all
    FROM Dish AS d
    LEFT JOIN order_lines AS l ON l.id_dish = d.id_dish
    GROUP BY d.id_dish, d.title, d.price
)
SELECT id_dish, title, price, orders_count, portions, max_in_order, revenue,
       CAST(100.0 * revenue / NULLIF(revenue_all, 0) AS DECIMAL(5, 2)) AS revenue_share,
       RANK() OVER (ORDER BY revenue DESC) AS revenue_rank
FROM dish_stats
WHERE (@min_portions IS NULL OR portions >= @min_portions)
ORDER BY revenue DESC, title;`;

export async function dishStats(query) {
  const params = validate(query, schema);
  const result = await runSql(prisma, SQL, params);

  const rows = result.map((row) => ({
    id_dish: row.id_dish,
    title: row.title,
    price: money(row.price),
    orders_count: row.orders_count,
    portions: row.portions,
    max_in_order: row.max_in_order,
    revenue: money(row.revenue),
    revenue_share: row.revenue_share === null ? '0.00' : money(row.revenue_share),
    revenue_rank: Number(row.revenue_rank),
  }));

  return {
    params,
    rows,
    summary: {
      dishes_count: rows.length,
      portions: rows.reduce((sum, row) => sum + row.portions, 0),
      revenue: money(sumBy(rows, (row) => row.revenue)),
    },
    sql: [{ title: 'SQL (Prisma $queryRaw)', text: SQL, params: showParams(params) }],
  };
}
