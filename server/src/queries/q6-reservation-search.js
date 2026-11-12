// Q6. Пошук бронювань за кількома параметрами: період, статус, столик, кількість осіб,
// ПІБ або телефон відвідувача. Усі параметри необов'язкові й поєднуються через AND.
// Прототип: ЛР2 №1 і №2 (WHERE з умовою рівності та умовою на дату). Замість YEAR(дата) = …
// період задається діапазоном date_time >= від AND date_time < (до + 1 день).
// Реалізація: Prisma findMany з динамічно складеним where.
import { prisma } from '../lib/prisma.js';
import { RESERVATION_STATUSES } from '../domain/dictionaries.js';
import { formatDateTime } from '../lib/format.js';
import { invalidField } from '../lib/http-error.js';
import { date, integer, oneOf, text, validate } from '../lib/validation.js';
import { checkPeriod, MAX_INT, nextDay } from './common.js';

const schema = {
  from: date({ required: false }),
  to: date({ required: false }),
  reservation_status: oneOf({ required: false, values: RESERVATION_STATUSES }),
  table_number: integer({ required: false, min: 1, max: MAX_INT }),
  people_min: integer({ required: false, min: 1, max: 1000 }),
  people_max: integer({ required: false, min: 1, max: 1000 }),
  visitor: text({ required: false, max: 100 }),
};

const SQL = `SELECT r.id_reservation, r.date_time, v.full_name, v.phone_number, r.table_number,
       t.capacity, r.people_count, r.reservation_status, o.id_order
FROM Reservation AS r
JOIN Visitor AS v    ON v.id_visitor = r.id_visitor
JOIN [Table] AS t    ON t.table_number = r.table_number
LEFT JOIN [Order] AS o ON o.id_reservation = r.id_reservation
WHERE (@from IS NULL OR r.date_time >= @from)
  AND (@to IS NULL OR r.date_time < DATEADD(DAY, 1, @to))
  AND (@reservation_status IS NULL OR r.reservation_status = @reservation_status)
  AND (@table_number IS NULL OR r.table_number = @table_number)
  AND (@people_min IS NULL OR r.people_count >= @people_min)
  AND (@people_max IS NULL OR r.people_count <= @people_max)
  AND (@visitor IS NULL OR v.full_name LIKE '%' + @visitor + '%'
                        OR v.phone_number LIKE '%' + @visitor + '%')
ORDER BY r.date_time, r.id_reservation;`;

export async function reservationSearch(query) {
  const params = validate(query, schema);
  checkPeriod(params.from, params.to);
  if (params.people_min && params.people_max && params.people_min > params.people_max) {
    throw invalidField('people_max', 'Максимум осіб має бути не менше за мінімум');
  }

  // До where потрапляють лише задані фільтри
  const where = {};
  if (params.from || params.to) {
    where.date_time = {
      ...(params.from && { gte: params.from }),
      ...(params.to && { lt: nextDay(params.to) }),
    };
  }
  if (params.reservation_status) where.reservation_status = params.reservation_status;
  if (params.table_number) where.table_number = params.table_number;
  if (params.people_min || params.people_max) {
    where.people_count = {
      ...(params.people_min && { gte: params.people_min }),
      ...(params.people_max && { lte: params.people_max }),
    };
  }
  if (params.visitor) {
    // contains → LIKE '%…%'; збірання Cyrillic_General_CI_AS не розрізняє великі й малі літери
    where.visitor = {
      OR: [
        { full_name: { contains: params.visitor } },
        { phone_number: { contains: params.visitor } },
      ],
    };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: { visitor: true, table: true, order: { select: { id_order: true } } },
    orderBy: [{ date_time: 'asc' }, { id_reservation: 'asc' }],
  });

  const rows = reservations.map((r) => ({
    id_reservation: r.id_reservation,
    date_time: formatDateTime(r.date_time),
    full_name: r.visitor.full_name,
    phone_number: r.visitor.phone_number,
    table_number: r.table_number,
    capacity: r.table.capacity,
    people_count: r.people_count,
    reservation_status: r.reservation_status,
    id_order: r.order?.id_order ?? null,
  }));

  const byStatus = Object.fromEntries(RESERVATION_STATUSES.map((status) => [status, 0]));
  for (const row of rows) byStatus[row.reservation_status] += 1;

  return {
    params,
    rows,
    summary: {
      found: rows.length,
      people: rows.reduce((sum, row) => sum + row.people_count, 0),
      with_order: rows.filter((row) => row.id_order !== null).length,
      by_status: byStatus,
    },
    sql: [
      { title: 'Еквівалентний SQL (запит будує Prisma: reservation.findMany з where)', text: SQL },
    ],
  };
}
