// Тестове читання через моделі Prisma (лише читання): кількість записів у кожній таблиці
// і перше замовлення разом з офіціантом, бронюванням і позиціями.
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';

// DATETIME у SQL Server не має часового поясу, Prisma читає його як UTC,
// тому для показу збереженого значення без зсуву беремо UTC-частину
const formatDateTime = (date) => date.toISOString().slice(0, 16).replace('T', ' ');

try {
  const counts = [
    ['Visitor', await prisma.visitor.count()],
    ['Table', await prisma.table.count()],
    ['Waiter', await prisma.waiter.count()],
    ['Dish', await prisma.dish.count()],
    ['Reservation', await prisma.reservation.count()],
    ['Order', await prisma.order.count()],
    ['OrderDetail', await prisma.orderDetail.count()],
  ];
  console.log('Кількість записів:');
  for (const [model, count] of counts) {
    console.log(`  ${model.padEnd(12)} ${count}`);
  }

  const order = await prisma.order.findFirst({
    orderBy: { id_order: 'asc' },
    include: {
      waiter: true,
      reservation: { include: { visitor: true } },
      order_details: { include: { dish: true }, orderBy: { id_dish: 'asc' } },
    },
  });

  if (order) {
    console.log(
      `\nЗамовлення №${order.id_order}: столик ${order.table_number}, ` +
        `офіціант ${order.waiter.full_name}, оплата «${order.payment_status}», чайові ${order.tips.toFixed(2)}`,
    );
    console.log(
      order.reservation
        ? `  бронювання №${order.reservation.id_reservation}: ${order.reservation.visitor.full_name}, ` +
            `${formatDateTime(order.reservation.date_time)}, «${order.reservation.reservation_status}»`
        : '  без бронювання',
    );
    for (const detail of order.order_details) {
      const sum = detail.dish.price.mul(detail.quantity);
      console.log(
        `  ${detail.dish.title}: ${detail.quantity} × ${detail.dish.price.toFixed(2)} = ${sum.toFixed(2)}`,
      );
    }
  }
} catch (err) {
  console.error('Не вдалося прочитати дані через Prisma:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
