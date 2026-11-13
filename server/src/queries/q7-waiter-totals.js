// Q7. Підсумки по офіціантах: кількість замовлень, виручка, середній чек, сума і середні чайові.
// Власна пропозиція (без прототипу в ЛР2): GROUP BY, COUNT, SUM, AVG.
// Реалізація поєднує обидва способи доступу до даних:
//   - кількість замовлень і чайові — агрегація Prisma ORM (order.groupBy з _count, _sum, _avg);
//   - виручка — параметризований SQL ($queryRaw), бо вона множить кількість з OrderDetail
//     на ціну з Dish, а groupBy Prisma рахує лише стовпці однієї таблиці.
// Етап 9: виручка — сума до сплати після знижки ([Order].discount_percent), окремо сума знижок.
// Офіціанти без замовлень теж показуються (з нулями).
import { prisma } from '../lib/prisma.js';
import { runSql } from '../lib/named-sql.js';
import { validate } from '../lib/validation.js';
import { decimal, money, paymentStatus, showParams, sumBy } from './common.js';

const schema = { payment_status: paymentStatus };

const SQL_GROUP_BY = `-- Еквівалент order.groupBy({ by: ['id_waiter'], _count, _sum: tips, _avg: tips })
SELECT o.id_waiter, COUNT(o.id_order) AS orders_count,
       SUM(o.tips) AS tips_total, AVG(o.tips) AS avg_tips
FROM [Order] AS o
WHERE (@payment_status IS NULL OR o.payment_status = @payment_status)
GROUP BY o.id_waiter;`;

// Знижка рахується від суми кожного замовлення окремо (CTE), потім підсумок по офіціанту
const SQL_REVENUE = `WITH order_totals AS (
    SELECT o.id_order, o.id_waiter,
           ROUND(SUM(od.quantity * d.price) * o.discount_percent / 100, 2) AS discount,
           SUM(od.quantity * d.price) AS order_total
    FROM [Order] AS o
    JOIN OrderDetail AS od ON od.id_order = o.id_order
    JOIN Dish AS d         ON d.id_dish = od.id_dish
    WHERE (@payment_status IS NULL OR o.payment_status = @payment_status)
    GROUP BY o.id_order, o.id_waiter, o.discount_percent
)
SELECT id_waiter, SUM(order_total - discount) AS revenue, SUM(discount) AS discounts
FROM order_totals
GROUP BY id_waiter;`;

export async function waiterTotals(query) {
  const params = validate(query, schema);
  const where = params.payment_status ? { payment_status: params.payment_status } : {};

  const [waiters, groups, revenues] = await Promise.all([
    prisma.waiter.findMany({ orderBy: { full_name: 'asc' } }),
    prisma.order.groupBy({
      by: ['id_waiter'],
      where,
      _count: { id_order: true },
      _sum: { tips: true },
      _avg: { tips: true },
    }),
    runSql(prisma, SQL_REVENUE, params),
  ]);

  const groupBy = new Map(groups.map((g) => [g.id_waiter, g]));
  const revenueBy = new Map(revenues.map((r) => [r.id_waiter, r]));

  const rows = waiters
    .map((waiter) => {
      const group = groupBy.get(waiter.id_waiter);
      const ordersCount = group?._count.id_order ?? 0;
      const sums = revenueBy.get(waiter.id_waiter);
      const revenue = decimal(sums?.revenue ?? 0);
      return {
        id_waiter: waiter.id_waiter,
        full_name: waiter.full_name,
        orders_count: ordersCount,
        revenue: money(revenue),
        discounts: money(decimal(sums?.discounts ?? 0)),
        avg_check: ordersCount ? money(revenue.div(ordersCount)) : null,
        tips_total: money(group?._sum.tips),
        avg_tips: group ? money(group._avg.tips) : null,
      };
    })
    .sort(
      (a, b) => Number(b.revenue) - Number(a.revenue) || a.full_name.localeCompare(b.full_name),
    );

  const ordersCount = rows.reduce((sum, row) => sum + row.orders_count, 0);
  const tipsTotal = sumBy(rows, (row) => row.tips_total);
  return {
    params,
    rows,
    summary: {
      waiters_count: rows.length,
      orders_count: ordersCount,
      revenue: money(sumBy(rows, (row) => row.revenue)),
      discounts: money(sumBy(rows, (row) => row.discounts)),
      tips_total: money(tipsTotal),
      avg_tips: ordersCount ? money(tipsTotal.div(ordersCount)) : null,
    },
    sql: [
      { title: 'Prisma ORM: order.groupBy (еквівалентний SQL)', text: SQL_GROUP_BY },
      {
        title: 'SQL (Prisma $queryRaw): виручка після знижок',
        text: SQL_REVENUE,
        params: showParams(params),
      },
    ],
  };
}
