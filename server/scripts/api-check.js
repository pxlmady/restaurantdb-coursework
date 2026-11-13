// Перевірка CRUD API через HTTP (етап 6, знижки — етап 9). Потрібен запущений сервер: npm run dev:server.
// Сценарій створює власні тестові записи (телефон +38099..., назви з позначкою «API-тест»),
// перевіряє правила й помилки, а наприкінці видаляє все, що створив.
// Наявні записи бази лише читаються. Запуск: npm run api:check
const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
const stamp = Date.now().toString().slice(-7);

let passed = 0;
let failed = 0;
const created = []; // [шлях для DELETE] у порядку створення

const call = async (method, path, body) => {
  const response = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
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

// Запит з очікуваним статусом
const expect = async (name, method, path, body, status) => {
  const result = await call(method, path, body);
  check(
    `${name} → ${status}`,
    result.status === status,
    `(отримано ${result.status}: ${JSON.stringify(result.body?.error ?? result.body)})`,
  );
  return result.body;
};

const counts = async () => {
  const resources = ['visitors', 'tables', 'waiters', 'dishes', 'reservations', 'orders'];
  const lists = await Promise.all(resources.map((r) => call('GET', `/${r}`)));
  return Object.fromEntries(resources.map((r, i) => [r, lists[i].body.length]));
};

const run = async () => {
  const health = await call('GET', '/health/db').catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`Сервер або база недоступні за адресою ${BASE}. Запустіть npm run dev:server.`);
    process.exit(1);
  }
  console.log('Довідники');
  const dict = await expect('GET /dictionaries', 'GET', '/dictionaries', null, 200);
  check(
    '3 статуси бронювання і 3 статуси оплати',
    dict.reservation_statuses.length === 3 && dict.payment_statuses.length === 3,
  );

  console.log('Відвідувачі');
  const visitor = await expect(
    'створення',
    'POST',
    '/visitors',
    { full_name: 'API-тест Відвідувач', phone_number: `+38099${stamp}` },
    201,
  );
  created.push(`/visitors/${visitor.id_visitor}`);
  await expect(
    'дубль телефону',
    'POST',
    '/visitors',
    { full_name: 'Інший', phone_number: `+38099${stamp}` },
    409,
  );
  await expect('порожнє ім’я', 'POST', '/visitors', { full_name: ' ', phone_number: '+380' }, 400);
  const v2 = await expect(
    'редагування',
    'PUT',
    `/visitors/${visitor.id_visitor}`,
    { full_name: 'API-тест Відвідувач (змінено)', phone_number: `+38099${stamp}` },
    200,
  );
  check('ім’я змінено', v2.full_name.endsWith('(змінено)'));
  await expect('неіснуючий', 'GET', '/visitors/999999', null, 404);
  await expect('некоректний id', 'GET', '/visitors/abc', null, 400);

  console.log('Столики');
  const tables = (await call('GET', '/tables')).body;
  const tableNumber = Math.max(...tables.map((t) => t.table_number)) + 100;
  const table = await expect(
    'створення',
    'POST',
    '/tables',
    { table_number: tableNumber, capacity: 2 },
    201,
  );
  created.push(`/tables/${table.table_number}`);
  await expect('дубль номера', 'POST', '/tables', { table_number: tableNumber, capacity: 4 }, 409);
  await expect(
    'місткість 0',
    'POST',
    '/tables',
    { table_number: tableNumber + 1, capacity: 0 },
    400,
  );
  const t2 = await expect(
    'редагування місткості',
    'PUT',
    `/tables/${tableNumber}`,
    { table_number: 1, capacity: 4 },
    200,
  );
  check('номер не змінився, місткість 4', t2.table_number === tableNumber && t2.capacity === 4);

  console.log('Офіціанти');
  const waiter = await expect(
    'створення',
    'POST',
    '/waiters',
    { full_name: 'API-тест Офіціант' },
    201,
  );
  created.push(`/waiters/${waiter.id_waiter}`);
  await expect('задовге ім’я', 'POST', '/waiters', { full_name: 'я'.repeat(101) }, 400);
  await expect(
    'редагування',
    'PUT',
    `/waiters/${waiter.id_waiter}`,
    { full_name: 'API-тест Офіціантка' },
    200,
  );

  console.log('Страви');
  const dish = await expect(
    'створення',
    'POST',
    '/dishes',
    { title: `API-тест страва ${stamp}`, price: '99.50', weight_grams: 200 },
    201,
  );
  created.push(`/dishes/${dish.id_dish}`);
  check('ціна у форматі 99.50', dish.price === '99.50');
  await expect(
    'дубль назви',
    'POST',
    '/dishes',
    { title: `API-тест страва ${stamp}`, price: 1, weight_grams: 1 },
    409,
  );
  await expect(
    'від’ємна ціна',
    'POST',
    '/dishes',
    { title: `API-тест x ${stamp}`, price: -1, weight_grams: 1 },
    400,
  );
  await expect(
    'редагування',
    'PUT',
    `/dishes/${dish.id_dish}`,
    { title: `API-тест страва ${stamp}`, price: 100, weight_grams: 210 },
    200,
  );

  console.log('Бронювання');
  const resBody = {
    id_visitor: visitor.id_visitor,
    table_number: tableNumber,
    date_time: '2026-12-31T19:30',
    people_count: 3,
  };
  await expect(
    'осіб більше за місткість',
    'POST',
    '/reservations',
    { ...resBody, people_count: 5 },
    400,
  );
  await expect(
    'неіснуючий відвідувач',
    'POST',
    '/reservations',
    { ...resBody, id_visitor: 999999 },
    400,
  );
  await expect(
    'неіснуюча дата 31.02',
    'POST',
    '/reservations',
    { ...resBody, date_time: '2026-02-31T10:00' },
    400,
  );
  await expect(
    'недопустимий статус',
    'POST',
    '/reservations',
    { ...resBody, reservation_status: 'Невідомо' },
    400,
  );
  const reservation = await expect('створення', 'POST', '/reservations', resBody, 201);
  created.push(`/reservations/${reservation.id_reservation}`);
  check(
    'статус за замовчуванням «Активне», час без зсуву',
    reservation.reservation_status === 'Активне' && reservation.date_time === '2026-12-31T19:30',
  );
  await expect(
    'той самий столик через 1 год 59 хв',
    'POST',
    '/reservations',
    { ...resBody, date_time: '2026-12-31T21:29' },
    409,
  );
  const cancelled = await expect(
    'скасоване бронювання на той самий час дозволене',
    'POST',
    '/reservations',
    { ...resBody, reservation_status: 'Скасоване' },
    201,
  );
  created.push(`/reservations/${cancelled.id_reservation}`);
  await expect(
    'відновлення скасованого на зайнятий час',
    'PUT',
    `/reservations/${cancelled.id_reservation}`,
    { ...resBody, reservation_status: 'Активне' },
    409,
  );
  const later = await expect(
    'той самий столик через 2 години',
    'POST',
    '/reservations',
    { ...resBody, date_time: '2026-12-31T21:30' },
    201,
  );
  created.push(`/reservations/${later.id_reservation}`);

  console.log('Замовлення');
  const anyDish = (await call('GET', '/dishes')).body.find((d) => d.id_dish !== dish.id_dish);
  const ordersBefore = (await call('GET', '/orders')).body.length;
  await expect(
    'страва не існує (транзакція відкочується)',
    'POST',
    '/orders',
    {
      id_reservation: reservation.id_reservation,
      id_waiter: waiter.id_waiter,
      payment_status: 'В очікуванні',
      details: [{ id_dish: 999999, quantity: 1 }],
    },
    400,
  );
  check(
    'після відкату замовлень стільки ж',
    (await call('GET', '/orders')).body.length === ordersBefore,
  );
  const order = await expect(
    'створення з 2 позиціями',
    'POST',
    '/orders',
    {
      id_reservation: reservation.id_reservation,
      id_waiter: waiter.id_waiter,
      table_number: 1,
      payment_status: 'В очікуванні',
      details: [
        { id_dish: dish.id_dish, quantity: 2 },
        { id_dish: anyDish.id_dish, quantity: 1 },
      ],
    },
    201,
  );
  created.push(`/orders/${order.id_order}`);
  check('столик узято з бронювання', order.table_number === tableNumber);
  const expectedTotal = (200 + Number(anyDish.price)).toFixed(2);
  check(`сума ${expectedTotal}`, order.total === expectedTotal, `(отримано ${order.total})`);
  await expect(
    'друге замовлення на те саме бронювання',
    'POST',
    '/orders',
    {
      id_reservation: reservation.id_reservation,
      id_waiter: waiter.id_waiter,
      payment_status: 'Оплачено',
    },
    409,
  );
  await expect(
    'без бронювання і без столика',
    'POST',
    '/orders',
    { id_waiter: waiter.id_waiter, payment_status: 'Оплачено' },
    400,
  );
  await expect(
    'дубль страви в позиціях',
    'POST',
    '/orders',
    {
      id_waiter: waiter.id_waiter,
      table_number: tableNumber,
      payment_status: 'Оплачено',
      details: [
        { id_dish: dish.id_dish, quantity: 1 },
        { id_dish: dish.id_dish, quantity: 2 },
      ],
    },
    400,
  );
  await expect(
    'від’ємні чайові',
    'PUT',
    `/orders/${order.id_order}`,
    {
      id_reservation: reservation.id_reservation,
      id_waiter: waiter.id_waiter,
      payment_status: 'Оплачено',
      tips: -5,
    },
    400,
  );
  const o2 = await expect(
    'редагування шапки',
    'PUT',
    `/orders/${order.id_order}`,
    {
      id_reservation: reservation.id_reservation,
      id_waiter: waiter.id_waiter,
      payment_status: 'Оплачено',
      tips: '25.00',
    },
    200,
  );
  check(
    'статус і чайові змінено, позиції збережено',
    o2.payment_status === 'Оплачено' && o2.tips === '25.00' && o2.items_count === 2,
  );

  console.log('Позиції замовлення');
  const detailsPath = `/orders/${order.id_order}/details`;
  await expect('дубль страви', 'POST', detailsPath, { id_dish: dish.id_dish, quantity: 1 }, 409);
  await expect('кількість 0', 'PUT', `${detailsPath}/${dish.id_dish}`, { quantity: 0 }, 400);
  const d2 = await expect(
    'зміна кількості',
    'PUT',
    `${detailsPath}/${dish.id_dish}`,
    { quantity: 3 },
    200,
  );
  check('сума позиції 300.00', d2.line_total === '300.00');
  await expect('видалення позиції', 'DELETE', `${detailsPath}/${anyDish.id_dish}`, null, 204);
  await expect(
    'додавання позиції',
    'POST',
    detailsPath,
    { id_dish: anyDish.id_dish, quantity: 1 },
    201,
  );
  const list = await expect('список позицій', 'GET', detailsPath, null, 200);
  check('2 позиції', list.length === 2);

  // Етап 9. Тестова страва коштує 100.00 грн, у тестового відвідувача спершу 1 оплачене
  // замовлення (вище). Правила: від 3 оплачених — 5 %, сума від 2000 грн — 10 %, більша з двох.
  console.log('Знижки');
  check('2 правила знижок у довіднику', dict.discount_rules?.length === 2);
  const preview = (body) =>
    expect('попередній розрахунок', 'POST', '/orders/discount-preview', body, 200);
  const p1 = await preview({ details: [{ id_dish: dish.id_dish, quantity: 20 }, { id_dish: '' }] });
  check(
    'сума 2000.00 без бронювання → 10 %, до сплати 1800.00',
    p1.discount_percent === 10 && p1.applied === 'big_order' && p1.total_due === '1800.00',
    JSON.stringify(p1),
  );
  const p2 = await preview({
    id_reservation: later.id_reservation,
    details: [{ id_dish: dish.id_dish, quantity: 19 }],
  });
  check(
    '1900.00 і 1 оплачене замовлення → 0 %',
    p2.discount_percent === 0 && p2.rules.every((r) => !r.met),
    JSON.stringify(p2),
  );
  const orderBody = (details, payment_status = 'В очікуванні') => ({
    id_waiter: waiter.id_waiter,
    table_number: tableNumber,
    payment_status,
    details: details.map((quantity) => ({ id_dish: dish.id_dish, quantity })),
  });
  const big = await expect('замовлення на 2000.00', 'POST', '/orders', orderBody([20]), 201);
  created.push(`/orders/${big.id_order}`);
  check(
    'знижка 10 %: 200.00, до сплати 1800.00',
    big.discount_percent === 10 && big.discount_amount === '200.00' && big.total_due === '1800.00',
    JSON.stringify(big),
  );
  const bigPath = `/orders/${big.id_order}`;
  const b2 = await expect('менше позицій (очікує оплати)', 'PUT', bigPath, orderBody([5]), 200);
  check('знижку перераховано → 0 %', b2.discount_percent === 0 && b2.total_due === '500.00');
  await expect(
    'позиція до 25 порцій',
    'PUT',
    `${bigPath}/details/${dish.id_dish}`,
    { quantity: 25 },
    200,
  );
  const b3 = (await call('GET', bigPath)).body;
  check(
    'після зміни позиції знижка 10 %',
    b3.discount_percent === 10 && b3.total_due === '2250.00',
  );
  const b4 = await expect('оплата', 'PUT', bigPath, orderBody([25], 'Оплачено'), 200);
  check('оплачене зберігає 10 %', b4.discount_percent === 10);
  const b5 = await expect('зміна оплаченого', 'PUT', bigPath, orderBody([1], 'Оплачено'), 200);
  check(
    'знижка оплаченого зафіксована: 10 % від 100.00',
    b5.discount_percent === 10 && b5.discount_amount === '10.00' && b5.total_due === '90.00',
    JSON.stringify(b5),
  );
  const p3 = await preview({ id_order: big.id_order, payment_status: 'Оплачено', details: [] });
  check(
    'розрахунок для оплаченого: frozen, 10 %',
    p3.frozen === true && p3.discount_percent === 10,
  );

  // Постійний відвідувач: ще 2 оплачені замовлення → 3, тоді наступне отримує 5 %
  const paidOrder = await expect(
    'оплачене замовлення №2 відвідувача',
    'POST',
    '/orders',
    { ...orderBody([1], 'Оплачено'), id_reservation: later.id_reservation },
    201,
  );
  created.push(`/orders/${paidOrder.id_order}`);
  check('1 попереднє оплачене → 0 %', paidOrder.discount_percent === 0);
  const res3 = await expect(
    'бронювання №3',
    'POST',
    '/reservations',
    { ...resBody, date_time: '2027-01-02T19:00' },
    201,
  );
  created.push(`/reservations/${res3.id_reservation}`);
  const res4 = await expect(
    'бронювання №4',
    'POST',
    '/reservations',
    { ...resBody, date_time: '2027-01-04T19:00' },
    201,
  );
  created.push(`/reservations/${res4.id_reservation}`);
  const o3 = await expect(
    'оплачене замовлення №3 відвідувача',
    'POST',
    '/orders',
    { ...orderBody([1], 'Оплачено'), id_reservation: res3.id_reservation },
    201,
  );
  created.push(`/orders/${o3.id_order}`);
  check('2 попередні оплачені → 0 %', o3.discount_percent === 0);
  const regular = await expect(
    'замовлення постійного відвідувача',
    'POST',
    '/orders',
    { ...orderBody([2]), id_reservation: res4.id_reservation },
    201,
  );
  created.push(`/orders/${regular.id_order}`);
  check(
    '3 оплачені → 5 %: 10.00, до сплати 190.00',
    regular.discount_percent === 5 &&
      regular.discount_amount === '10.00' &&
      regular.total_due === '190.00',
    JSON.stringify(regular),
  );
  const both = await expect(
    'постійний відвідувач і сума 2000.00',
    'PUT',
    `/orders/${regular.id_order}`,
    { ...orderBody([20]), id_reservation: res4.id_reservation },
    200,
  );
  check('знижки не сумуються: 10 %', both.discount_percent === 10 && both.total_due === '1800.00');

  console.log('Заборонені видалення (є пов’язані записи)');
  await expect('відвідувач з бронюванням', 'DELETE', `/visitors/${visitor.id_visitor}`, null, 409);
  await expect('столик з бронюванням', 'DELETE', `/tables/${tableNumber}`, null, 409);
  await expect('офіціант із замовленням', 'DELETE', `/waiters/${waiter.id_waiter}`, null, 409);
  await expect('страва в замовленні', 'DELETE', `/dishes/${dish.id_dish}`, null, 409);
  await expect(
    'бронювання із замовленням',
    'DELETE',
    `/reservations/${reservation.id_reservation}`,
    null,
    409,
  );
  await expect(
    'зміна столика бронювання із замовленням',
    'PUT',
    `/reservations/${reservation.id_reservation}`,
    { ...resBody, table_number: 1, people_count: 2 },
    409,
  );
};

const cleanup = async () => {
  console.log('Видалення тестових записів');
  for (const path of created.reverse()) {
    await expect(`DELETE ${path}`, 'DELETE', path, null, 204);
    await expect(`GET ${path}`, 'GET', path, null, 404);
  }
};

try {
  const before = await counts().catch(() => null);
  await run();
  await cleanup();
  if (before) {
    const after = await counts();
    check(
      'кількість записів як до перевірки',
      JSON.stringify(before) === JSON.stringify(after),
      JSON.stringify({ before, after }),
    );
  }
} catch (err) {
  failed += 1;
  console.error('Перевірку перервано:', err.message);
  if (created.length) await cleanup().catch(() => {});
}
console.log(`\nУспішно: ${passed}, помилок: ${failed}`);
process.exitCode = failed > 0 ? 1 : 0;
