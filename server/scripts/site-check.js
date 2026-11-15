// Перевірка API сайту ресторану через HTTP (етап 10). Потрібен запущений сервер: npm run dev:server.
// Сценарій бронює столики на далеку дату (2098 рік, де інших бронювань немає) з тестових
// телефонів +38098..., перевіряє підбір столика, передзамовлення, знижку, скасування
// й одночасні бронювання, а наприкінці видаляє все, що створив, через CRUD API.
// Наявні записи бази лише читаються. Запуск: npm run site:check
const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
const stamp = Date.now().toString().slice(-5);
const phoneOf = (index) => `+38098${stamp}${String(index).padStart(2, '0')}`;
const isTestPhone = (value) => value.startsWith(`+38098${stamp}`);

// Дні без чужих бронювань; кожен блок перевірок працює у власному дні
const DAY = '2098-03-10';
const DAY_PARALLEL = '2098-03-11';
const at = (time, day = DAY) => `${day}T${time}`;

let passed = 0;
let failed = 0;

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

const expect = async (name, method, path, body, status) => {
  const result = await call(method, path, body);
  check(
    `${name} → ${status}`,
    result.status === status,
    `(отримано ${result.status}: ${JSON.stringify(result.body?.error ?? result.body)})`,
  );
  return result.body;
};

const list = async (resource) => (await call('GET', `/${resource}`)).body;

const counts = async () => {
  const resources = ['visitors', 'tables', 'waiters', 'dishes', 'reservations', 'orders'];
  const lists = await Promise.all(resources.map(list));
  return Object.fromEntries(resources.map((r, i) => [r, lists[i].length]));
};

const query = (params) => new URLSearchParams(params).toString();

const run = async () => {
  const health = await call('GET', '/health/db').catch(() => null);
  if (!health || health.status !== 200) {
    console.error(`Сервер або база недоступні за адресою ${BASE}. Запустіть npm run dev:server.`);
    process.exit(1);
  }
  const [tables, dishes, waiters] = await Promise.all(['tables', 'dishes', 'waiters'].map(list));
  if (tables.length === 0 || dishes.length === 0 || waiters.length === 0) {
    console.error('Для перевірки потрібні хоча б один столик, одна страва й один офіціант.');
    process.exit(1);
  }
  const capacities = tables.map((t) => t.capacity);
  const maxPeople = Math.max(...capacities);
  const people = Math.min(2, maxPeople);
  // Найменший столик, що вміщує компанію: саме його має вибрати сервер у вільний день
  const fitting = tables
    .filter((t) => t.capacity >= people)
    .sort((a, b) => a.capacity - b.capacity || a.table_number - b.table_number);
  const byPrice = [...dishes].sort((a, b) => Number(a.price) - Number(b.price));
  const cheap = byPrice[0];
  const expensive = byPrice.at(-1);

  console.log('Довідка й меню');
  const info = await expect('GET /site/info', 'GET', '/site/info', null, 200);
  check('найбільша компанія = найбільший столик', info.max_people === maxPeople);
  check(
    'години бронювання в межах годин роботи',
    info.rules.open_hour < info.rules.last_booking_hour &&
      info.rules.last_booking_hour + info.rules.reservation_hours === info.rules.close_hour,
  );
  const menu = await expect('GET /site/menu', 'GET', '/site/menu', null, 200);
  check('у меню всі страви з таблиці Dish', menu.length === dishes.length);
  check(
    'ціни як у CRUD API',
    menu.every((m) => dishes.find((d) => d.id_dish === m.id_dish)?.price === m.price),
  );
  check('популярних страв не більше трьох', menu.filter((m) => m.popular).length <= 3);

  console.log('Вільний столик');
  const slot = { date_time: at('12:00'), people_count: people };
  const free = await expect('вільний день', 'GET', `/site/availability?${query(slot)}`, null, 200);
  check(
    `підібрано найменший столик (№${fitting[0].table_number})`,
    free.available && free.table.table_number === fitting[0].table_number,
    JSON.stringify(free),
  );
  const q8 = await call('GET', `/queries/free-tables?${query(slot)}`);
  check(
    'той самий столик, що й перший у запиті Q8',
    q8.body.summary.best_table === free.table.table_number,
  );
  const tooMany = await expect(
    'завелика компанія',
    'GET',
    `/site/availability?${query({ ...slot, people_count: maxPeople + 1 })}`,
    null,
    200,
  );
  check('пояснення: завелика компанія', !tooMany.available && tooMany.reason === 'too_many_people');
  await expect(
    'час у минулому',
    'GET',
    `/site/availability?${query({ ...slot, date_time: '2020-01-01T12:00' })}`,
    null,
    400,
  );
  await expect(
    'поза годинами бронювання',
    'GET',
    `/site/availability?${query({ ...slot, date_time: at('23:00') })}`,
    null,
    400,
  );
  await expect('без параметрів', 'GET', '/site/availability', null, 400);

  console.log('Бронювання без передзамовлення');
  const bookingBody = {
    full_name: 'Сайт-тест Відвідувач',
    phone_number: phoneOf(1),
    ...slot,
  };
  const first = await expect('новий відвідувач', 'POST', '/site/bookings', bookingBody, 201);
  check('створено відвідувача', first.visitor_is_new === true);
  check(
    'столик, статус і замовлення',
    first.table_number === fitting[0].table_number &&
      first.reservation_status === 'Активне' &&
      first.order === null &&
      first.can_cancel === true,
    JSON.stringify(first),
  );
  const stored = await expect(
    'бронювання видно в CRUD API',
    'GET',
    `/reservations/${first.id_reservation}`,
    null,
    200,
  );
  check(
    'ті самі дані в таблиці Reservation',
    stored.date_time === slot.date_time &&
      stored.people_count === people &&
      stored.table_number === first.table_number &&
      stored.visitor.phone_number === phoneOf(1),
  );
  const dup = await call('POST', '/site/bookings', bookingBody);
  check('те саме бронювання вдруге → 409', dup.status === 409, JSON.stringify(dup.body));
  check(
    'помилка стосується поля date_time',
    dup.body?.error?.details?.some((d) => d.field === 'date_time'),
  );

  console.log('Той самий телефон, інший час, з передзамовленням');
  const spaced = phoneOf(1).replace(/^(\+380)(\d{2})(\d{3})(\d{4})$/, '$1 ($2) $3-$4');
  const second = await expect(
    'телефон з пробілами й дужками',
    'POST',
    '/site/bookings',
    {
      ...bookingBody,
      full_name: 'Інше Ім’я',
      phone_number: spaced,
      date_time: at('15:00'),
      details: [{ id_dish: cheap.id_dish, quantity: 2 }],
    },
    201,
  );
  check('відвідувача знайдено за телефоном', second.visitor_is_new === false);
  check('ім’я відвідувача не перезаписано', second.visitor.full_name === bookingBody.full_name);
  const cheapTotal = (Number(cheap.price) * 2).toFixed(2);
  check(
    'замовлення «В очікуванні» з офіціантом і сумою',
    second.order?.payment_status === 'В очікуванні' &&
      waiters.some((w) => w.full_name === second.order.waiter) &&
      second.order.total === cheapTotal &&
      second.order.details.length === 1,
    JSON.stringify(second.order),
  );
  const order = await expect(
    'замовлення видно в CRUD API',
    'GET',
    `/orders/${second.order.id_order}`,
    null,
    200,
  );
  check(
    'замовлення прив’язане до бронювання і його столика',
    order.id_reservation === second.id_reservation && order.table_number === second.table_number,
  );

  console.log('Інший відвідувач на той самий час');
  const other = await expect(
    'другий відвідувач о 12:00',
    'POST',
    '/site/bookings',
    { ...bookingBody, full_name: 'Сайт-тест Другий', phone_number: phoneOf(2) },
    201,
  );
  check(
    'йому дано інший столик',
    other.table_number !== first.table_number,
    `(обидва на столику №${other.table_number})`,
  );
  if (fitting.length > 1) {
    check(
      `наступний за місткістю столик (№${fitting[1].table_number})`,
      other.table_number === fitting[1].table_number,
    );
  }

  console.log('Знижка в передзамовленні');
  const bigQuantity = Math.ceil(2000 / Number(expensive.price));
  if (bigQuantity <= info.rules.max_quantity && Number(expensive.price) > 0) {
    const details = [{ id_dish: expensive.id_dish, quantity: bigQuantity }];
    const preview = await expect(
      'попередній розрахунок',
      'POST',
      '/site/preview',
      { phone_number: phoneOf(3), details },
      200,
    );
    const total = Number(expensive.price) * bigQuantity;
    check(
      'сума від 2000 грн → 10 %',
      preview.discount_percent === 10 &&
        preview.applied === 'big_order' &&
        preview.total === total.toFixed(2) &&
        preview.total_due === (total * 0.9).toFixed(2) &&
        preview.known_visitor === false,
      JSON.stringify(preview),
    );
    const big = await expect(
      'бронювання з великим передзамовленням',
      'POST',
      '/site/bookings',
      {
        ...bookingBody,
        full_name: 'Сайт-тест Третій',
        phone_number: phoneOf(3),
        date_time: at('18:00'),
        details,
      },
      201,
    );
    check(
      'знижку записано в замовлення',
      big.order.discount_percent === 10 && big.order.total_due === preview.total_due,
      JSON.stringify(big.order),
    );
    const bigOrder = await call('GET', `/orders/${big.order.id_order}`);
    check('у таблиці [Order] discount_percent = 10', bigOrder.body.discount_percent === 10);
  } else {
    console.log('  (пропущено: з наявними цінами суму 2000 грн не набрати)');
  }
  const emptyPreview = await expect(
    'розрахунок без страв',
    'POST',
    '/site/preview',
    { details: [] },
    200,
  );
  check(
    'порожнє передзамовлення: 0.00',
    emptyPreview.total === '0.00' && emptyPreview.discount_percent === 0,
  );

  console.log('Помилки введення (у базі нічого не з’являється)');
  const beforeErrors = await counts();
  const bad = { ...bookingBody, phone_number: phoneOf(4), date_time: at('13:00') };
  await expect(
    'телефон не у форматі +380',
    'POST',
    '/site/bookings',
    { ...bad, phone_number: '0981234567' },
    400,
  );
  await expect('порожнє ім’я', 'POST', '/site/bookings', { ...bad, full_name: ' ' }, 400);
  await expect('0 осіб', 'POST', '/site/bookings', { ...bad, people_count: 0 }, 400);
  await expect(
    'час у минулому',
    'POST',
    '/site/bookings',
    { ...bad, date_time: '2020-01-01T12:00' },
    400,
  );
  await expect(
    'час поза годинами бронювання',
    'POST',
    '/site/bookings',
    { ...bad, date_time: at('21:30') },
    400,
  );
  await expect(
    'завелика компанія',
    'POST',
    '/site/bookings',
    { ...bad, people_count: maxPeople + 1 },
    409,
  );
  await expect(
    'неіснуюча страва',
    'POST',
    '/site/bookings',
    { ...bad, details: [{ id_dish: 2147483000, quantity: 1 }] },
    400,
  );
  await expect(
    'та сама страва двічі',
    'POST',
    '/site/bookings',
    {
      ...bad,
      details: [
        { id_dish: cheap.id_dish, quantity: 1 },
        { id_dish: cheap.id_dish, quantity: 2 },
      ],
    },
    400,
  );
  await expect(
    'забагато порцій',
    'POST',
    '/site/bookings',
    { ...bad, details: [{ id_dish: cheap.id_dish, quantity: info.rules.max_quantity + 1 }] },
    400,
  );
  const afterErrors = await counts();
  check(
    'після відхилених запитів кількість записів не змінилася (транзакція скасована)',
    JSON.stringify(beforeErrors) === JSON.stringify(afterErrors),
    JSON.stringify({ beforeErrors, afterErrors }),
  );

  console.log('Мої бронювання і скасування');
  const mine = await expect(
    'пошук за телефоном',
    'GET',
    `/site/bookings?${query({ phone_number: spaced })}`,
    null,
    200,
  );
  check(
    'два бронювання, новіші зверху',
    mine.bookings.length === 2 &&
      mine.bookings[0].id_reservation === second.id_reservation &&
      mine.visitor.full_name === bookingBody.full_name,
    JSON.stringify(mine),
  );
  const nobody = await expect(
    'невідомий телефон',
    'GET',
    `/site/bookings?${query({ phone_number: phoneOf(99) })}`,
    null,
    200,
  );
  check('порожній результат без помилки', nobody.visitor === null && nobody.bookings.length === 0);
  await expect('пошук без телефону', 'GET', '/site/bookings', null, 400);
  const cancelPath = `/site/bookings/${second.id_reservation}/cancel`;
  await expect(
    'скасування з чужим телефоном',
    'POST',
    cancelPath,
    { phone_number: phoneOf(2) },
    404,
  );
  const cancelled = await expect(
    'скасування',
    'POST',
    cancelPath,
    { phone_number: phoneOf(1) },
    200,
  );
  check(
    'бронювання «Скасоване», передзамовлення «Скасовано»',
    cancelled.reservation_status === 'Скасоване' &&
      cancelled.order.payment_status === 'Скасовано' &&
      cancelled.can_cancel === false,
    JSON.stringify(cancelled),
  );
  await expect('повторне скасування', 'POST', cancelPath, { phone_number: phoneOf(1) }, 409);
  const again = await expect(
    'після скасування можна забронювати той самий час',
    'POST',
    '/site/bookings',
    { ...bookingBody, date_time: at('15:00') },
    201,
  );
  check('столик знову вільний', again.table_number === second.table_number);

  console.log('Одночасні бронювання одного часу');
  const attempts = tables.length + 2;
  const parallel = await Promise.all(
    Array.from({ length: attempts }, (_, i) =>
      call('POST', '/site/bookings', {
        full_name: `Сайт-тест Одночасний ${i + 1}`,
        phone_number: phoneOf(10 + i),
        date_time: at('12:00', DAY_PARALLEL),
        people_count: 1,
      }),
    ),
  );
  const ok = parallel.filter((r) => r.status === 201);
  const rejected = parallel.filter((r) => r.status === 409);
  check(
    `з ${attempts} запитів успішних рівно стільки, скільки столиків (${tables.length})`,
    ok.length === tables.length && rejected.length === attempts - tables.length,
    JSON.stringify(parallel.map((r) => r.status)),
  );
  check(
    'жоден столик не заброньовано двічі',
    new Set(ok.map((r) => r.body.table_number)).size === ok.length,
    JSON.stringify(ok.map((r) => r.body.table_number)),
  );
};

// Записи попередніх запусків, перерваних до прибирання: телефон +38098… і ім'я «Сайт-тест …»
const isLeftover = (v) =>
  v.phone_number.startsWith('+38098') && v.full_name.startsWith('Сайт-тест');

// Видаляє все, що створили тестові телефони (цього й перерваних запусків):
// замовлення → бронювання → відвідувачі
const cleanup = async (title = 'Видалення тестових записів') => {
  console.log(title);
  const visitors = (await list('visitors')).filter(
    (v) => isTestPhone(v.phone_number) || isLeftover(v),
  );
  const ids = new Set(visitors.map((v) => v.id_visitor));
  const reservations = (await list('reservations')).filter((r) => ids.has(r.id_visitor));
  let removed = 0;
  for (const reservation of reservations) {
    if (reservation.id_order) {
      removed += (await call('DELETE', `/orders/${reservation.id_order}`)).status === 204;
    }
    removed += (await call('DELETE', `/reservations/${reservation.id_reservation}`)).status === 204;
  }
  for (const visitor of visitors) {
    removed += (await call('DELETE', `/visitors/${visitor.id_visitor}`)).status === 204;
  }
  console.log(`  видалено записів: ${removed}`);
};

// Спочатку прибираємо залишки перерваних запусків, щоб порівнювати кількість записів без них
await cleanup('Залишки попередніх запусків').catch(() => {});
const before = await counts().catch(() => null);
try {
  await run();
} catch (err) {
  failed += 1;
  console.error('Перевірку перервано:', err.message);
}
if (before) {
  await cleanup().catch((err) => console.error('Не вдалося видалити тестові записи:', err.message));
  const after = await counts();
  check(
    'кількість записів як до перевірки',
    JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify({ before, after }),
  );
}
console.log(`\nУспішно: ${passed}, помилок: ${failed}`);
process.exitCode = failed > 0 ? 1 : 0;
