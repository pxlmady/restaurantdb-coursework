// Знижки замовлень (етап 9).
// У базі зберігається лише відсоток: [Order].discount_percent DECIMAL(5,2), CHECK 0..100.
// Сума замовлення в базі не зберігається, тому сума знижки й сума до сплати рахуються:
//   знижка   = ROUND(сума позицій × відсоток / 100, 2)
//   до сплати = сума позицій − знижка   (чайові до знижки не входять)
//
// Правила (знижки не сумуються, береться більша):
//   1) постійний відвідувач — щонайменше 3 інші оплачені замовлення цього відвідувача → 5 %;
//   2) велике замовлення — сума позицій від 2000 грн → 10 %.
// Відвідувач пов'язаний із замовленням лише через бронювання, тому замовлення без бронювання
// може отримати тільки знижку за суму.
//
// Коли відсоток визначається: під час створення замовлення і під час кожної зміни, поки
// замовлення «В очікуванні» (або переходить з цього статусу в «Оплачено»/«Скасовано»).
// Знижка закритого замовлення («Оплачено», «Скасовано») зафіксована: її не змінюють ні нові
// правила, ні нові замовлення відвідувача.
import { Prisma } from '@prisma/client';

export const PENDING_STATUS = 'В очікуванні';
const PAID_STATUS = 'Оплачено';

// Пороги й відсотки — змінюються тут, в одному місці
export const DISCOUNT_RULES = [
  {
    code: 'regular',
    title: 'Постійний відвідувач',
    percent: 5,
    min_paid_orders: 3,
    description: 'від 3 інших оплачених замовлень відвідувача (за бронюваннями)',
  },
  {
    code: 'big_order',
    title: 'Велике замовлення',
    percent: 10,
    min_total: '2000.00',
    description: 'сума позицій від 2000 грн',
  },
];

const ZERO = new Prisma.Decimal(0);
const rule = (code) => DISCOUNT_RULES.find((r) => r.code === code);

// Сума позицій [{ quantity, dish: { price } }] за поточними цінами меню
export const detailsTotal = (details) =>
  details.reduce((sum, d) => sum.add(new Prisma.Decimal(d.dish.price).mul(d.quantity)), ZERO);

// Сума знижки й сума до сплати для заданого відсотка
export function applyDiscount(total, percent) {
  const amount = new Prisma.Decimal(total)
    .mul(percent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { discount_amount: amount, total_due: new Prisma.Decimal(total).sub(amount) };
}

// Чи зафіксована знижка: замовлення вже закрите і залишається закритим
export const isDiscountFrozen = (storedStatus, newStatus) =>
  storedStatus !== PENDING_STATUS && newStatus !== PENDING_STATUS;

const ordersWord = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'оплачене замовлення';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'оплачені замовлення';
  return 'оплачених замовлень';
};

/**
 * Обчислює знижку за правилами. Працює і в транзакції (tx), і з prisma.
 * @param client  prisma або tx
 * @param input   { id_order?: number|null, id_reservation?: number|null,
 *                  id_visitor?: number|null, total: Decimal }
 *                id_visitor — для сайту ресторану (етап 10): бронювання ще не створене,
 *                але відвідувача вже знайдено за телефоном
 * @returns { percent, applied, rules: [{ code, title, percent, met, text }], visitor }
 */
export async function evaluateDiscount(
  client,
  { id_order = null, id_reservation = null, id_visitor = null, total },
) {
  const regular = rule('regular');
  const big = rule('big_order');

  // 1) Постійний відвідувач: лише якщо є бронювання (через нього знаємо відвідувача)
  let visitor = null;
  let paidOrders = 0;
  if (id_visitor) {
    visitor = await client.visitor.findUnique({
      where: { id_visitor },
      select: { id_visitor: true, full_name: true },
    });
  } else if (id_reservation) {
    const reservation = await client.reservation.findUnique({
      where: { id_reservation },
      select: { visitor: { select: { id_visitor: true, full_name: true } } },
    });
    visitor = reservation?.visitor ?? null;
  }
  if (visitor) {
    paidOrders = await client.order.count({
      where: {
        payment_status: PAID_STATUS,
        reservation: { id_visitor: visitor.id_visitor },
        ...(id_order && { NOT: { id_order } }),
      },
    });
  }
  const regularMet = Boolean(visitor) && paidOrders >= regular.min_paid_orders;
  const regularText = visitor
    ? `${visitor.full_name}: ${paidOrders} ${ordersWord(paidOrders)} раніше, потрібно від ${regular.min_paid_orders}`
    : 'Відвідувача не визначено: замовлення без бронювання';

  // 2) Велике замовлення
  const sum = new Prisma.Decimal(total);
  const bigMet = sum.gte(big.min_total);
  const bigText = `Сума позицій ${sum.toFixed(2)} грн, потрібно від ${big.min_total} грн`;

  const rules = [
    {
      code: regular.code,
      title: regular.title,
      percent: regular.percent,
      met: regularMet,
      text: regularText,
    },
    { code: big.code, title: big.title, percent: big.percent, met: bigMet, text: bigText },
  ];
  // Знижки не сумуються: береться найбільша з тих, що виконані
  const best = rules.filter((r) => r.met).sort((a, b) => b.percent - a.percent)[0] ?? null;

  return {
    percent: best ? best.percent : 0,
    applied: best ? best.code : null,
    rules,
    visitor,
    paid_orders: paidOrders,
  };
}

// Перерахунок і запис знижки збереженого замовлення (у транзакції), після того як
// записано його шапку й позиції. Без force закрите замовлення не перераховується.
// Повертає відсоток, що діє після виклику.
export async function refreshOrderDiscount(tx, id_order, { force = false } = {}) {
  const order = await tx.order.findUnique({
    where: { id_order },
    include: { order_details: { include: { dish: true } } },
  });
  if (!order) return null;
  if (!force && order.payment_status !== PENDING_STATUS) return Number(order.discount_percent);
  const { percent } = await evaluateDiscount(tx, {
    id_order,
    id_reservation: order.id_reservation,
    total: detailsTotal(order.order_details),
  });
  if (!order.discount_percent.eq(percent)) {
    await tx.order.update({ where: { id_order }, data: { discount_percent: percent } });
  }
  return percent;
}
