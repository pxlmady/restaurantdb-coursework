// Q8. Вільні столики на дату й час для N осіб.
// Власна пропозиція (без прототипу в ЛР2): NOT EXISTS + умова на місткість.
// Правило курсової (етап 7): бронювання займає столик на 2 години, тому столик вільний,
// якщо в нього немає нескасованого бронювання, ближчого за 2 години до заданого часу.
// Реалізація: параметризований SQL через Prisma $queryRaw.
import { prisma } from '../lib/prisma.js';
import { runSql } from '../lib/named-sql.js';
import { dateTime, integer, validate } from '../lib/validation.js';
import { showParams } from './common.js';

export const RESERVATION_HOURS = 2;

const schema = {
  date_time: dateTime(),
  people_count: integer({ min: 1, max: 1000 }),
};

const SQL = `SELECT t.table_number, t.capacity,
       t.capacity - @people_count AS spare_seats
FROM [Table] AS t
WHERE t.capacity >= @people_count
  AND NOT EXISTS (
      SELECT 1
      FROM Reservation AS r
      WHERE r.table_number = t.table_number
        AND r.reservation_status <> N'Скасоване'
        AND r.date_time > DATEADD(HOUR, -@hours, @date_time)
        AND r.date_time < DATEADD(HOUR, @hours, @date_time)
  )
ORDER BY t.capacity, t.table_number;`;

// Зайняті в цей час столики (щоб показати, чому столик не потрапив у результат)
const SQL_BUSY = `SELECT r.table_number, r.id_reservation, r.date_time, r.people_count
FROM Reservation AS r
WHERE r.reservation_status <> N'Скасоване'
  AND r.date_time > DATEADD(HOUR, -@hours, @date_time)
  AND r.date_time < DATEADD(HOUR, @hours, @date_time)
ORDER BY r.table_number;`;

export async function freeTables(query) {
  const params = validate(query, schema);
  const sqlParams = { ...params, hours: RESERVATION_HOURS };
  const [result, busy, tablesCount] = await Promise.all([
    runSql(prisma, SQL, sqlParams),
    runSql(prisma, SQL_BUSY, sqlParams),
    prisma.table.count(),
  ]);

  const rows = result.map((row) => ({
    table_number: row.table_number,
    capacity: row.capacity,
    spare_seats: Number(row.spare_seats), // int − параметр дає BIGINT
  }));

  return {
    params,
    rows,
    summary: {
      free: rows.length,
      tables_count: tablesCount,
      // Найменший відповідний столик — перший у результаті (сортування за місткістю)
      best_table: rows[0]?.table_number ?? null,
      busy_tables: [...new Set(busy.map((r) => r.table_number))],
    },
    sql: [{ title: 'SQL (Prisma $queryRaw)', text: SQL, params: showParams(sqlParams) }],
  };
}
