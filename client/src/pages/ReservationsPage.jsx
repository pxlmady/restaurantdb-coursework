import { useState } from 'react';
import { Chip, Typography } from '@mui/material';
import CrudPage from '../components/CrudPage.jsx';
import StatusFilter from '../components/StatusFilter.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { formatDateTime, nextHour, STATUS_COLORS } from '../lib/format.js';

// Таблиця Reservation: відвідувач і столик вибираються зі списків (зовнішні ключі),
// статус — одне з трьох значень CHECK. Сервер також перевіряє, що осіб не більше за місткість.
function buildEntity({ visitors, tables, statuses }) {
  const visitorOptions = (visitors ?? []).map((v) => ({
    value: v.id_visitor,
    label: `${v.full_name} — ${v.phone_number}`,
  }));
  const tableOptions = (tables ?? []).map((t) => ({
    value: t.table_number,
    label: `Столик №${t.table_number} — до ${t.capacity} осіб`,
  }));
  const capacityOf = (number) =>
    (tables ?? []).find((t) => String(t.table_number) === String(number))?.capacity;

  return {
    endpoint: '/reservations',
    getId: (row) => row.id_reservation,
    names: {
      add: 'Додати бронювання',
      create: 'Нове бронювання',
      edit: (row) => `Бронювання №${row.id_reservation}`,
      deleteTitle: 'Видалити бронювання?',
      deleteText: (row) =>
        `Бронювання №${row.id_reservation} (${row.visitor.full_name}, ` +
        `${formatDateTime(row.date_time)}) буде видалено. ` +
        'Видалення неможливе, якщо за бронюванням уже є замовлення.',
      saved: (row, edited) => `Бронювання №${row.id_reservation} ${edited ? 'змінено' : 'додано'}`,
      deleted: (row) => `Бронювання №${row.id_reservation} видалено`,
    },
    columns: [
      { field: 'id_reservation', label: 'ID' },
      {
        field: 'date_time',
        label: 'Дата і час',
        nowrap: true,
        render: (row) => formatDateTime(row.date_time),
      },
      {
        field: 'visitor',
        label: 'Відвідувач',
        sortValue: (row) => row.visitor.full_name,
        render: (row) => (
          <>
            {row.visitor.full_name}
            <Typography variant="body2" color="text.secondary">
              {row.visitor.phone_number}
            </Typography>
          </>
        ),
      },
      { field: 'table_number', label: 'Столик', align: 'right' },
      {
        field: 'people_count',
        label: 'Осіб',
        align: 'right',
        render: (row) => `${row.people_count} з ${row.table.capacity}`,
      },
      {
        field: 'reservation_status',
        label: 'Статус',
        render: (row) => (
          <Chip
            size="small"
            label={row.reservation_status}
            color={STATUS_COLORS[row.reservation_status]}
          />
        ),
      },
      {
        field: 'id_order',
        label: 'Замовлення',
        render: (row) => (row.id_order ? `№${row.id_order}` : '—'),
      },
    ],
    initialSort: { field: 'date_time', direction: 'desc' },
    getSearchText: (row) =>
      `${row.id_reservation} ${row.visitor.full_name} ${row.visitor.phone_number} ` +
      `${formatDateTime(row.date_time)}`,
    searchPlaceholder: 'ПІБ, телефон або дата',
    fields: (values, row) => {
      const capacity = capacityOf(values.table_number);
      const hasOrder = Boolean(row?.id_order);
      return [
        {
          name: 'id_visitor',
          label: 'Відвідувач',
          type: 'autocomplete',
          options: visitorOptions,
          required: true,
          helperText: 'Почніть вводити ПІБ або телефон',
        },
        {
          name: 'table_number',
          label: 'Столик',
          type: 'select',
          options: tableOptions,
          required: true,
          disabled: hasOrder,
          helperText: hasOrder
            ? `Столик не змінюється: за бронюванням є замовлення №${row.id_order}`
            : undefined,
        },
        {
          name: 'date_time',
          label: 'Дата і час',
          type: 'datetime',
          required: true,
          helperText: 'Бронювання займає столик на 2 години',
        },
        {
          name: 'people_count',
          label: 'Кількість осіб',
          type: 'number',
          required: true,
          helperText: capacity ? `Не більше ${capacity} (місткість столика)` : undefined,
        },
        {
          name: 'reservation_status',
          label: 'Статус',
          type: 'select',
          options: (statuses ?? []).map((s) => ({ value: s, label: s })),
          required: true,
        },
      ];
    },
    emptyValues: () => ({
      id_visitor: '',
      table_number: '',
      date_time: nextHour(),
      people_count: '2',
      reservation_status: 'Активне',
    }),
    toValues: (row) => ({
      id_visitor: String(row.id_visitor),
      table_number: String(row.table_number),
      date_time: row.date_time,
      people_count: String(row.people_count),
      reservation_status: row.reservation_status,
    }),
  };
}

export default function ReservationsPage() {
  const visitors = useApiData('/visitors');
  const tables = useApiData('/tables');
  const dictionaries = useApiData('/dictionaries');
  const [status, setStatus] = useState('');

  const statuses = dictionaries.data?.reservation_statuses;
  const entity = buildEntity({ visitors: visitors.data, tables: tables.data, statuses });

  return (
    <CrudPage
      title="Бронювання"
      description="Бронювання столиків відвідувачами. Замовлення за бронюванням створюється в розділі «Замовлення»."
      entity={entity}
      filterRows={status ? (row) => row.reservation_status === status : null}
      toolbar={<StatusFilter statuses={statuses} value={status} onChange={setStatus} />}
    />
  );
}
