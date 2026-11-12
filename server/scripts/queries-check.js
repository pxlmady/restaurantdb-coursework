// Перевірка запитів Q1–Q8 через HTTP (етап 8). Потрібен запущений сервер: npm run dev:server.
// Лише читає дані: нічого не створює й не змінює. Перевірки не залежать від конкретних демо-даних:
// результати запитів звіряються між собою і з CRUD API етапу 6 (наприклад, виручка Q5 і Q7
// дорівнює сумі замовлень із /api/orders). Запуск: npm run queries:check
const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;

let passed = 0;
let failed = 0;

const call = async (path) => {
  const response = await fetch(BASE + path);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

const check = (name, condition, extra = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
};

const query = (path, params = {}) => `/queries/${path}?${new URLSearchParams(params)}`;

// Запит з очікуваним статусом; повертає тіло відповіді
const expect = async (name, path, status = 200) => {
  const result = await call(path);
  check(
    `${name} → ${status}`,
    result.status === status,
    `(отримано ${result.status}: ${JSON.stringify(result.body?.error ?? '').slice(0, 300)})`,
  );
  return result.body;
};

// Помилка 400 саме для потрібного поля
const expectInvalid = async (name, path, field) => {
  const body = await expect(name, path, 400);
  check(
    `  помилка поля ${field}`,
    body?.error?.details?.some((d) => d.field === field),
  );
};

const cents = (value) => Math.round(Number(value) * 100);
const sumCents = (rows, pick) => rows.reduce((sum, row) => sum + cents(pick(row)), 0);
const hasSql = (body) => Array.isArray(body?.sql) && body.sql.every((s) => s.title && s.text);

const run = async () => {
  const health = await call('/health/db').catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`Сервер або база недоступні за адресою ${BASE}. Запустіть npm run dev:server.`);
    process.exit(1);
  }
  const [orders, reservations, visitors, dishes, waiters, tables] = await Promise.all(
    ['orders', 'reservations', 'visitors', 'dishes', 'waiters', 'tables'].map(
      async (r) => (await call(`/${r}`)).body,
    ),
  );
  const paid = orders.filter((o) => o.payment_status === 'Оплачено');
  const ordersTotal = (list) => sumCents(list, (o) => o.total);

  console.log('Q1. Деталізація замовлень (Prisma findMany)');
  const q1 = await expect('усі позиції', query('order-details'));
  check(
    'кількість рядків = кількість позицій у всіх замовленнях',
    q1.rows.length === orders.reduce((n, o) => n + o.items_count, 0),
  );
  check('«разом» = сума всіх замовлень', cents(q1.summary.total) === ordersTotal(orders));
  check(
    'замовлення без бронювання не випадають (LEFT JOIN)',
    orders
      .filter((o) => !o.reservation && o.items_count > 0)
      .every((o) => q1.rows.some((r) => r.id_order === o.id_order && r.visitor === null)),
  );
  check('є текст SQL', hasSql(q1));
  const waiter = orders[0]?.id_waiter;
  if (waiter) {
    const q1w = await expect(
      'фільтр статус + офіціант',
      query('order-details', { payment_status: 'Оплачено', id_waiter: waiter }),
    );
    const expected = paid.filter((o) => o.id_waiter === waiter);
    check(
      'сума збігається із замовленнями офіціанта',
      cents(q1w.summary.total) === ordersTotal(expected),
    );
  }
  await expectInvalid(
    'некоректний столик',
    query('order-details', { table_number: 'abc' }),
    'table_number',
  );

  console.log('Q2. Витрати відвідувачів ($queryRaw, GROUP BY + HAVING)');
  const q2 = await expect(
    'оплачені замовлення',
    query('visitor-spending', { payment_status: 'Оплачено' }),
  );
  check(
    'сума = оплачені замовлення з бронюванням',
    cents(q2.summary.total) === ordersTotal(paid.filter((o) => o.reservation && o.items_count > 0)),
  );
  check(
    'відсортовано за сумою спадно',
    q2.rows.every((r, i) => i === 0 || cents(q2.rows[i - 1].total_spent) >= cents(r.total_spent)),
  );
  const threshold = q2.rows[Math.floor(q2.rows.length / 2)]?.total_spent ?? '0';
  const q2min = await expect(
    'HAVING мінімальна сума',
    query('visitor-spending', { payment_status: 'Оплачено', min_total: threshold }),
  );
  check(
    'усі суми ≥ порогу',
    q2min.rows.every((r) => cents(r.total_spent) >= cents(threshold)),
  );
  await expectInvalid(
    'кінець періоду раніше початку',
    query('visitor-spending', { from: '2026-11-10', to: '2026-11-01' }),
    'to',
  );

  console.log('Q3. Без страв від X грн ($queryRaw, HAVING з CASE)');
  const maxPrice = Math.max(...dishes.map((d) => Number(d.price)));
  const q3all = await expect(
    'поріг вищий за всі ціни',
    query('no-expensive-dishes', { price: maxPrice + 1 }),
  );
  check(
    'тоді підходять усі відвідувачі із замовленнями',
    q3all.rows.length === q3all.summary.visitors_with_orders,
  );
  const q3 = await expect('поріг 200', query('no-expensive-dishes', { price: 200 }));
  check(
    'найдорожча замовлена страва кожного < 200',
    q3.rows.every((r) => Number(r.max_price) < 200),
  );
  await expectInvalid('поріг не число', query('no-expensive-dishes', { price: 'abc' }), 'price');

  console.log('Q4. Без повʼязаних записів (NOT EXISTS / EXCEPT)');
  const q4a = await expect(
    'відвідувачі без бронювань',
    query('without-activity', { mode: 'visitors_without_reservations' }),
  );
  const withReservations = new Set(reservations.map((r) => r.id_visitor));
  check(
    'збігається з CRUD API',
    q4a.rows.length === visitors.filter((v) => !withReservations.has(v.id_visitor)).length &&
      q4a.rows.every((r) => !withReservations.has(r.id_visitor)),
  );
  const q4b = await expect(
    'відвідувачі без замовлень',
    query('without-activity', { mode: 'visitors_without_orders' }),
  );
  const withOrders = new Set(
    orders.filter((o) => o.reservation).map((o) => o.reservation.visitor.id_visitor),
  );
  check(
    'жоден не має замовлень, а без бронювань входять усі',
    q4b.rows.every((r) => !withOrders.has(r.id_visitor)) && q4b.rows.length >= q4a.rows.length,
  );
  const q4c = await expect(
    'страви без замовлень',
    query('without-activity', { mode: 'dishes_not_ordered' }),
  );
  const ordered = new Set(orders.flatMap((o) => o.details.map((d) => d.id_dish)));
  check(
    'збігається з CRUD API',
    q4c.rows.length === dishes.filter((d) => !ordered.has(d.id_dish)).length &&
      q4c.rows.every((r) => !ordered.has(r.id_dish)),
  );
  await expectInvalid('невідомий режим', query('without-activity', { mode: 'bad' }), 'mode');

  console.log('Q5. Статистика страв (GROUP BY + віконні функції)');
  const q5 = await expect('усі страви', query('dish-stats'));
  check('у результаті всі страви меню (LEFT JOIN)', q5.rows.length === dishes.length);
  check('виручка = сума всіх замовлень', cents(q5.summary.revenue) === ordersTotal(orders));
  const share = q5.rows.reduce((s, r) => s + Number(r.revenue_share), 0);
  check(
    'частки виручки в сумі ≈ 100 %',
    q5.summary.revenue === '0.00' || Math.abs(share - 100) < 0.1,
  );
  check('рейтинг 1 у найбільшої виручки', q5.rows[0]?.revenue_rank === 1);
  const q5paid = await expect(
    'лише оплачені, від 5 порцій',
    query('dish-stats', { payment_status: 'Оплачено', min_portions: 5 }),
  );
  check(
    'усі мають ≥ 5 порцій',
    q5paid.rows.every((r) => r.portions >= 5),
  );
  await expectInvalid(
    'відʼємна кількість порцій',
    query('dish-stats', { min_portions: -1 }),
    'min_portions',
  );

  console.log('Q6. Пошук бронювань (Prisma findMany з кількома умовами)');
  const q6 = await expect('без фільтрів', query('reservation-search'));
  check('знайдено всі бронювання', q6.rows.length === reservations.length);
  const sample = reservations[0];
  if (sample) {
    const day = sample.date_time.slice(0, 10);
    const q6f = await expect(
      'день + статус + столик + частина телефону',
      query('reservation-search', {
        from: day,
        to: day,
        reservation_status: sample.reservation_status,
        table_number: sample.table_number,
        visitor: sample.visitor.phone_number.slice(-4),
      }),
    );
    check(
      'знайдено це бронювання, усі рядки відповідають умовам',
      q6f.rows.some((r) => r.id_reservation === sample.id_reservation) &&
        q6f.rows.every(
          (r) =>
            r.date_time.startsWith(day) &&
            r.table_number === sample.table_number &&
            r.reservation_status === sample.reservation_status,
        ),
    );
    const lower = sample.visitor.full_name.split(' ')[0].toLowerCase();
    const q6n = await expect(
      'ПІБ малими літерами',
      query('reservation-search', { visitor: lower }),
    );
    check(
      'пошук не залежить від регістру',
      q6n.rows.some((r) => r.id_reservation === sample.id_reservation),
    );
  }
  await expectInvalid(
    'неіснуюча дата',
    query('reservation-search', { from: '2026-02-30' }),
    'from',
  );
  await expectInvalid(
    'мінімум осіб > максимуму',
    query('reservation-search', { people_min: 5, people_max: 2 }),
    'people_max',
  );

  console.log('Q7. Підсумки по офіціантах (groupBy Prisma + $queryRaw)');
  const q7 = await expect('усі замовлення', query('waiter-totals'));
  check('усі офіціанти, навіть без замовлень', q7.rows.length === waiters.length);
  check('кількість замовлень збігається', q7.summary.orders_count === orders.length);
  check('виручка = сума замовлень', cents(q7.summary.revenue) === ordersTotal(orders));
  check(
    'чайові = сума чайових замовлень',
    cents(q7.summary.tips_total) === sumCents(orders, (o) => o.tips),
  );
  const q7paid = await expect(
    'лише оплачені',
    query('waiter-totals', { payment_status: 'Оплачено' }),
  );
  check('виручка оплачених збігається', cents(q7paid.summary.revenue) === ordersTotal(paid));
  check('є два тексти SQL', hasSql(q7) && q7.sql.length === 2);

  console.log('Q8. Вільні столики (NOT EXISTS + місткість)');
  const busyRes = reservations.find((r) => r.reservation_status !== 'Скасоване');
  if (busyRes) {
    const q8 = await expect(
      'час наявного бронювання',
      query('free-tables', { date_time: busyRes.date_time, people_count: 1 }),
    );
    check(
      'заброньований столик не вільний',
      !q8.rows.some((r) => r.table_number === busyRes.table_number) &&
        q8.summary.busy_tables.includes(busyRes.table_number),
    );
  }
  const maxCapacity = Math.max(...tables.map((t) => t.capacity));
  const q8big = await expect(
    'більше осіб, ніж будь-який столик',
    query('free-tables', { date_time: '2030-01-01T12:00', people_count: maxCapacity + 1 }),
  );
  check('немає вільних столиків', q8big.rows.length === 0);
  const q8far = await expect(
    'далека дата, 1 особа',
    query('free-tables', { date_time: '2030-01-01T12:00', people_count: 1 }),
  );
  check(
    'вільні всі столики, найменші першими',
    q8far.rows.length === tables.length &&
      q8far.rows.every((r, i) => i === 0 || q8far.rows[i - 1].capacity <= r.capacity),
  );
  await expectInvalid('без дати', query('free-tables', { people_count: 2 }), 'date_time');
};

await run();
console.log(`\nРезультат: ${passed} пройдено, ${failed} не пройдено`);
process.exitCode = failed > 0 ? 1 : 0;
