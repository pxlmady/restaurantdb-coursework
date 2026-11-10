import { useState } from 'react';
import {
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CrudPage from '../components/CrudPage.jsx';
import StatusFilter from '../components/StatusFilter.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { formatDateTime, formatMoney, STATUS_COLORS } from '../lib/format.js';
import OrderDialog from './OrderDialog.jsx';

// Таблиця [Order] разом з позиціями OrderDetail
const orders = {
  endpoint: '/orders',
  getId: (row) => row.id_order,
  names: {
    add: 'Додати замовлення',
    deleteTitle: 'Видалити замовлення?',
    deleteText: (row) =>
      `Замовлення №${row.id_order} буде видалено разом з усіма позиціями (${row.items_count}): ` +
      'зв’язок OrderDetail → [Order] має ON DELETE CASCADE.',
    saved: (row, edited) =>
      `Замовлення №${row.id_order} ${edited ? 'змінено' : 'створено'}, сума ${formatMoney(row.total)}`,
    deleted: (row) => `Замовлення №${row.id_order} видалено`,
  },
  columns: [
    { field: 'id_order', label: 'ID' },
    {
      field: 'date_time',
      label: 'Бронювання',
      sortValue: (row) => row.reservation?.date_time,
      render: (row) =>
        row.reservation ? (
          <>
            №{row.id_reservation}, {formatDateTime(row.reservation.date_time)}
            <Typography variant="body2" color="text.secondary">
              {row.reservation.visitor.full_name}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            без бронювання
          </Typography>
        ),
    },
    { field: 'table_number', label: 'Столик', align: 'right' },
    {
      field: 'waiter',
      label: 'Офіціант',
      sortValue: (row) => row.waiter.full_name,
      render: (row) => row.waiter.full_name,
    },
    { field: 'items_count', label: 'Позицій', align: 'right' },
    {
      field: 'total',
      label: 'Сума',
      align: 'right',
      render: (row) => formatMoney(row.total),
      nowrap: true,
      sortValue: (row) => Number(row.total),
    },
    {
      field: 'tips',
      label: 'Чайові',
      align: 'right',
      render: (row) => formatMoney(row.tips),
      nowrap: true,
      sortValue: (row) => Number(row.tips),
    },
    {
      field: 'payment_status',
      label: 'Оплата',
      render: (row) => (
        <Chip size="small" label={row.payment_status} color={STATUS_COLORS[row.payment_status]} />
      ),
    },
  ],
  getSearchText: (row) =>
    `${row.id_order} ${row.waiter.full_name} ${row.reservation?.visitor.full_name ?? ''} ` +
    row.details.map((d) => d.dish.title).join(' '),
  searchPlaceholder: 'Офіціант, відвідувач, страва',
  // Сервер приймає позиції разом із шапкою і зберігає все в одній транзакції
  toBody: (values) => values,
};

// Позиції замовлення в розгорнутому рядку таблиці
function OrderDetails({ order }) {
  if (order.details.length === 0) {
    return <Typography color="text.secondary">У замовленні немає позицій</Typography>;
  }
  return (
    <Table size="small" sx={{ maxWidth: 640 }}>
      <TableHead>
        <TableRow>
          <TableCell>Страва</TableCell>
          <TableCell align="right">Ціна</TableCell>
          <TableCell align="right">Кількість</TableCell>
          <TableCell align="right">Сума</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {order.details.map((detail) => (
          <TableRow key={detail.id_dish}>
            <TableCell>{detail.dish.title}</TableCell>
            <TableCell align="right">{formatMoney(detail.dish.price)}</TableCell>
            <TableCell align="right">{detail.quantity}</TableCell>
            <TableCell align="right">{formatMoney(detail.line_total)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={3} sx={{ fontWeight: 600 }}>
            Разом (за поточними цінами меню)
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 600 }}>
            {formatMoney(order.total)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export default function OrdersPage() {
  const reservations = useApiData('/reservations');
  const waiters = useApiData('/waiters');
  const tables = useApiData('/tables');
  const dishes = useApiData('/dishes');
  const dictionaries = useApiData('/dictionaries');
  const [status, setStatus] = useState('');

  const lookupsReady = [reservations, waiters, tables, dishes, dictionaries].every((d) => d.data);
  const lookupError = [reservations, waiters, tables, dishes, dictionaries].find(
    (d) => d.error,
  )?.error;
  const statuses = dictionaries.data?.payment_statuses;

  return (
    <>
      {lookupError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Не вдалося завантажити довідники для форми: {lookupError.message}
        </Alert>
      )}
      <CrudPage
        title="Замовлення"
        description="Замовлення з позиціями. Сума не зберігається в базі, а рахується за поточними цінами страв. Розгорніть рядок, щоб побачити позиції."
        entity={orders}
        filterRows={status ? (row) => row.payment_status === status : null}
        toolbar={
          <StatusFilter
            label="Статус оплати"
            statuses={statuses}
            value={status}
            onChange={setStatus}
          />
        }
        renderDetail={(row) => <OrderDetails order={row} />}
        // Після збереження чи видалення змінюється список вільних бронювань
        onChanged={reservations.reload}
        renderDialog={({ row, onSubmit, onClose }) =>
          lookupsReady ? (
            <OrderDialog
              row={row}
              lookups={{
                reservations: reservations.data,
                waiters: waiters.data,
                tables: tables.data,
                dishes: dishes.data,
                statuses,
              }}
              onSubmit={onSubmit}
              onClose={onClose}
            />
          ) : null
        }
      />
    </>
  );
}
