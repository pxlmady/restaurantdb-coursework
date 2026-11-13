// Опис сторінок запитів Q1–Q8 (етап 8): фільтри, стовпці таблиці, підсумки.
// Самі запити виконує сервер: server/src/queries/*.js, маршрути /api/queries/<endpoint>.
import { Chip, Typography } from '@mui/material';
import { formatDateTime, formatMoney, nextHour, STATUS_COLORS } from '../../lib/format.js';

const ALL = { value: '', label: 'Усі' };
const PAYMENT_STATUSES = ['Оплачено', 'В очікуванні', 'Скасовано'];
const RESERVATION_STATUSES = ['Активне', 'Скасоване', 'Завершене'];
const options = (values) => [ALL, ...values.map((value) => ({ value, label: value }))];

const paymentFilter = {
  name: 'payment_status',
  label: 'Статус оплати',
  type: 'select',
  options: options(PAYMENT_STATUSES),
};

const statusChip = (status) => <Chip size="small" label={status} color={STATUS_COLORS[status]} />;

const money = (field, label) => ({
  field,
  label,
  align: 'right',
  nowrap: true,
  render: (row) => formatMoney(row[field]),
  sortValue: (row) => (row[field] === null ? null : Number(row[field])),
});

const number = (field, label) => ({ field, label, align: 'right' });

const visitorColumns = [
  { field: 'full_name', label: 'Відвідувач' },
  { field: 'phone_number', label: 'Телефон', nowrap: true },
];

const waiterOptions = (lookups) => [
  ALL,
  ...(lookups?.waiters ?? []).map((w) => ({ value: String(w.id_waiter), label: w.full_name })),
];
const tableOptions = (lookups) => [
  ALL,
  ...(lookups?.tables ?? []).map((t) => ({
    value: String(t.table_number),
    label: `№${t.table_number} (${t.capacity} місць)`,
  })),
];

export const q1 = {
  code: 'Q1',
  title: 'Деталізація замовлень',
  description:
    'Кожна позиція замовлення з відвідувачем, офіціантом, столиком, стравою, кількістю й сумою. ' +
    'Замовлення без бронювання теж показуються (відвідувач невідомий).',
  prototype: 'ПР1, SQLQuery3.sql (JOIN 6 таблиць), INNER → LEFT JOIN',
  technique: 'Prisma findMany з include',
  endpoint: 'order-details',
  needsLookups: true,
  filters: (_values, lookups) => [
    paymentFilter,
    { name: 'id_waiter', label: 'Офіціант', type: 'select', options: waiterOptions(lookups) },
    { name: 'table_number', label: 'Столик', type: 'select', options: tableOptions(lookups) },
  ],
  initialValues: { payment_status: '', id_waiter: '', table_number: '' },
  getRowId: (row) => `${row.id_order}-${row.dish}`,
  columns: [
    number('id_order', 'Замовлення'),
    {
      field: 'visitor',
      label: 'Відвідувач',
      render: (row) =>
        row.visitor ?? (
          <Typography variant="body2" color="text.secondary">
            без бронювання
          </Typography>
        ),
    },
    { field: 'waiter', label: 'Офіціант' },
    number('table_number', 'Столик'),
    { field: 'dish', label: 'Страва' },
    money('price', 'Ціна'),
    number('quantity', 'Кількість'),
    money('line_total', 'Сума'),
    { field: 'payment_status', label: 'Оплата', render: (row) => statusChip(row.payment_status) },
  ],
  summary: (s) => [
    { label: 'Замовлень', value: s.orders_count },
    { label: 'Позицій', value: s.lines_count },
    { label: 'Порцій', value: s.portions },
    { label: 'Разом', value: formatMoney(s.total), hint: 'за поточними цінами меню' },
  ],
};

export const q2 = {
  code: 'Q2',
  title: 'Витрати відвідувачів',
  description:
    'Скільки замовлень зробив кожен відвідувач і скільки витратив: сума, середній і найбільший ' +
    'чек. Враховуються замовлення за бронюваннями; період — за датою бронювання. Суми — до ' +
    'сплати, тобто з урахуванням знижки замовлення (без чайових).',
  prototype: 'ЛР2 №4 (скільки сплатила кожна компанія)',
  technique: '$queryRaw: CTE, SUM, COUNT, AVG, MAX, GROUP BY, HAVING',
  endpoint: 'visitor-spending',
  filters: [
    { name: 'from', label: 'Період від', type: 'date' },
    { name: 'to', label: 'Період до (включно)', type: 'date' },
    paymentFilter,
    {
      name: 'min_total',
      label: 'Сума від, грн',
      type: 'money',
      helperText: 'HAVING SUM(...) >= …',
    },
  ],
  initialValues: { from: '', to: '', payment_status: 'Оплачено', min_total: '' },
  getRowId: (row) => row.id_visitor,
  columns: [
    ...visitorColumns,
    number('orders_count', 'Замовлень'),
    money('total_spent', 'Витрачено'),
    money('avg_check', 'Середній чек'),
    money('max_check', 'Найбільший чек'),
  ],
  summary: (s) => [
    { label: 'Відвідувачів', value: s.visitors_count },
    { label: 'Замовлень', value: s.orders_count },
    { label: 'Разом витрачено', value: formatMoney(s.total) },
  ],
};

export const q3 = {
  code: 'Q3',
  title: 'Відвідувачі без дорогих страв',
  description:
    'Відвідувачі із замовленнями, які жодного разу не замовляли страву з ціною від заданого ' +
    'порогу. Умова в HAVING рахує дорогі позиції через CASE і вимагає, щоб їх було 0.',
  prototype: 'ЛР2 №5 і представлення з ПР2.1',
  technique: '$queryRaw: GROUP BY + HAVING SUM(CASE …) = 0',
  endpoint: 'no-expensive-dishes',
  filters: [{ name: 'price', label: 'Поріг ціни, грн', type: 'money', required: true }],
  initialValues: { price: '200' },
  getRowId: (row) => row.id_visitor,
  columns: [
    ...visitorColumns,
    number('orders_count', 'Замовлень'),
    money('max_price', 'Найдорожча замовлена страва'),
  ],
  summary: (s) => [
    { label: 'Знайдено відвідувачів', value: s.visitors_count },
    { label: 'Усього із замовленнями', value: s.visitors_with_orders },
    { label: 'Поріг ціни', value: formatMoney(s.price) },
  ],
};

const Q4_MODES = [
  { value: 'visitors_without_reservations', label: 'Відвідувачі без бронювань' },
  { value: 'visitors_without_orders', label: 'Відвідувачі без замовлень' },
  { value: 'dishes_not_ordered', label: 'Страви, яких ніхто не замовляв' },
];

export const q4 = {
  code: 'Q4',
  title: 'Записи без повʼязаних даних',
  description:
    'Антизʼєднання: відвідувачі, у яких немає бронювань або замовлень, і страви, яких немає ' +
    'в жодному замовленні. Такі записи можна безпечно видаляти: на них ніщо не посилається.',
  prototype: 'ЛР2 №6, №7 (NOT EXISTS, EXCEPT)',
  technique: '$queryRaw: NOT EXISTS / EXCEPT',
  endpoint: 'without-activity',
  filters: [{ name: 'mode', label: 'Що шукати', type: 'select', options: Q4_MODES }],
  initialValues: { mode: Q4_MODES[0].value },
  getRowId: (row) => row.id_visitor ?? row.id_dish,
  columns: (data) =>
    data?.params.mode === 'dishes_not_ordered'
      ? [
          { field: 'title', label: 'Страва' },
          money('price', 'Ціна'),
          number('weight_grams', 'Вага, г'),
        ]
      : [
          ...visitorColumns,
          ...(data?.params.mode === 'visitors_without_orders'
            ? [number('reservations_count', 'Бронювань')]
            : []),
        ],
  summary: (s, data) => [
    { label: 'Знайдено', value: s.found },
    {
      label: data.params.mode === 'dishes_not_ordered' ? 'Усього страв' : 'Усього відвідувачів',
      value: s.total,
    },
  ],
};

export const q5 = {
  code: 'Q5',
  title: 'Статистика страв',
  description:
    'Для кожної страви меню: у скількох замовленнях була, скільки порцій продано, найбільша ' +
    'кількість в одному замовленні, виручка, її частка та місце в рейтингу. Виручка страви — ' +
    'за цінами меню, без знижок замовлень (знижка діє на замовлення, а не на страву).',
  prototype: 'ЛР2 №3 (MAX знижки на товар, MAX() OVER)',
  technique: '$queryRaw: GROUP BY, SUM/MAX, SUM() OVER (), RANK() OVER',
  endpoint: 'dish-stats',
  filters: [paymentFilter, { name: 'min_portions', label: 'Порцій від', type: 'number', min: 0 }],
  initialValues: { payment_status: '', min_portions: '' },
  getRowId: (row) => row.id_dish,
  columns: [
    number('revenue_rank', 'Місце'),
    { field: 'title', label: 'Страва' },
    money('price', 'Ціна'),
    number('orders_count', 'Замовлень'),
    number('portions', 'Порцій'),
    number('max_in_order', 'Макс. в замовленні'),
    money('revenue', 'Виручка'),
    {
      field: 'revenue_share',
      label: 'Частка',
      align: 'right',
      render: (row) => `${row.revenue_share} %`,
      sortValue: (row) => Number(row.revenue_share),
    },
  ],
  summary: (s) => [
    { label: 'Страв', value: s.dishes_count },
    { label: 'Порцій', value: s.portions },
    { label: 'Виручка', value: formatMoney(s.revenue) },
  ],
};

export const q6 = {
  code: 'Q6',
  title: 'Пошук бронювань',
  description:
    'Пошук за кількома параметрами одночасно: період, статус, столик, кількість осіб, ' +
    'ПІБ або телефон відвідувача. Незаповнені поля не обмежують пошук.',
  prototype: 'ЛР2 №1, №2 (WHERE з рівністю та умовою на дату)',
  technique: 'Prisma findMany з динамічним where',
  endpoint: 'reservation-search',
  needsLookups: true,
  filters: (_values, lookups) => [
    { name: 'from', label: 'Дата від', type: 'date' },
    { name: 'to', label: 'Дата до (включно)', type: 'date' },
    {
      name: 'reservation_status',
      label: 'Статус',
      type: 'select',
      options: options(RESERVATION_STATUSES),
    },
    { name: 'table_number', label: 'Столик', type: 'select', options: tableOptions(lookups) },
    { name: 'people_min', label: 'Осіб від', type: 'number' },
    { name: 'people_max', label: 'Осіб до', type: 'number' },
    { name: 'visitor', label: 'ПІБ або телефон', type: 'text', maxLength: 100 },
  ],
  initialValues: {
    from: '',
    to: '',
    reservation_status: '',
    table_number: '',
    people_min: '',
    people_max: '',
    visitor: '',
  },
  getRowId: (row) => row.id_reservation,
  columns: [
    number('id_reservation', 'ID'),
    {
      field: 'date_time',
      label: 'Дата й час',
      nowrap: true,
      render: (row) => formatDateTime(row.date_time),
    },
    ...visitorColumns,
    number('table_number', 'Столик'),
    number('people_count', 'Осіб'),
    {
      field: 'reservation_status',
      label: 'Статус',
      render: (row) => statusChip(row.reservation_status),
    },
    {
      field: 'id_order',
      label: 'Замовлення',
      align: 'right',
      render: (row) => (row.id_order ? `№${row.id_order}` : '—'),
    },
  ],
  summary: (s) => [
    { label: 'Знайдено', value: s.found },
    { label: 'Осіб разом', value: s.people },
    { label: 'Із замовленням', value: s.with_order },
    ...Object.entries(s.by_status).map(([status, count]) => ({ label: status, value: count })),
  ],
};

export const q7 = {
  code: 'Q7',
  title: 'Підсумки по офіціантах',
  description:
    'Кількість замовлень, виручка після знижок, надані знижки, середній чек і чайові кожного ' +
    'офіціанта. Офіціанти без замовлень показуються з нулями. Чайові рахує агрегація Prisma, ' +
    'виручку й знижки — SQL.',
  prototype: 'немає (власна пропозиція)',
  technique: 'Prisma groupBy (_count, _sum, _avg) + $queryRaw',
  endpoint: 'waiter-totals',
  filters: [paymentFilter],
  initialValues: { payment_status: '' },
  getRowId: (row) => row.id_waiter,
  columns: [
    { field: 'full_name', label: 'Офіціант' },
    number('orders_count', 'Замовлень'),
    money('revenue', 'Виручка'),
    money('discounts', 'Знижки'),
    money('avg_check', 'Середній чек'),
    money('tips_total', 'Чайові разом'),
    money('avg_tips', 'Середні чайові'),
  ],
  summary: (s) => [
    { label: 'Офіціантів', value: s.waiters_count },
    { label: 'Замовлень', value: s.orders_count },
    { label: 'Виручка', value: formatMoney(s.revenue) },
    { label: 'Знижки', value: formatMoney(s.discounts) },
    { label: 'Чайові', value: formatMoney(s.tips_total) },
    { label: 'Середні чайові', value: formatMoney(s.avg_tips) },
  ],
};

export const q8 = {
  code: 'Q8',
  title: 'Вільні столики',
  description:
    'Столики, у яких на заданий час немає нескасованого бронювання ближче ніж за 2 години ' +
    '(правило курсової) і які вміщують потрібну кількість осіб. Найменші підходящі — першими.',
  prototype: 'немає (власна пропозиція)',
  technique: '$queryRaw: NOT EXISTS + DATEADD + умова на місткість',
  endpoint: 'free-tables',
  filters: [
    { name: 'date_time', label: 'Дата й час', type: 'datetime', required: true },
    { name: 'people_count', label: 'Кількість осіб', type: 'number', required: true },
  ],
  initialValues: () => ({ date_time: nextHour(), people_count: '2' }),
  getRowId: (row) => row.table_number,
  columns: [
    number('table_number', 'Столик'),
    number('capacity', 'Місць'),
    number('spare_seats', 'Вільних місць понад потрібні'),
  ],
  summary: (s) => [
    { label: 'Вільних столиків', value: s.free },
    { label: 'Усього столиків', value: s.tables_count },
    { label: 'Найкращий варіант', value: s.best_table ? `№${s.best_table}` : '—' },
    {
      label: 'Зайняті в цей час',
      value: s.busy_tables.length ? s.busy_tables.map((n) => `№${n}`).join(', ') : 'немає',
    },
  ],
};

export const QUERY_DEFINITIONS = [q1, q2, q3, q4, q5, q6, q7, q8];
