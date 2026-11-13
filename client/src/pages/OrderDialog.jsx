import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { splitApiError } from '../api/client.js';
import DiscountSummary from '../components/DiscountSummary.jsx';
import FormField from '../components/FormField.jsx';
import { useDiscountPreview } from '../hooks/useDiscountPreview.js';
import { formatDateTime } from '../lib/format.js';

// Гроші рахуємо в копійках цілими числами, щоб уникнути похибок дробових чисел
const toCents = (money) => Math.round(Number(money) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

let lineKey = 0;
const newLine = (id_dish = '', quantity = '1') => ({ key: ++lineKey, id_dish, quantity });

// Форма замовлення: шапка ([Order]) і позиції (OrderDetail) зберігаються одним запитом,
// який сервер виконує в одній транзакції (POST або PUT /api/orders з масивом details).
export default function OrderDialog({ row, lookups, onSubmit, onClose }) {
  const { reservations, waiters, tables, dishes, statuses } = lookups;

  const [values, setValues] = useState(() =>
    row
      ? {
          id_reservation: row.id_reservation ? String(row.id_reservation) : '',
          id_waiter: String(row.id_waiter),
          table_number: String(row.table_number),
          payment_status: row.payment_status,
          tips: row.tips,
        }
      : {
          id_reservation: '',
          id_waiter: '',
          table_number: '',
          payment_status: 'В очікуванні',
          tips: '0',
        },
  );
  const [lines, setLines] = useState(() =>
    row ? row.details.map((d) => newLine(String(d.id_dish), String(d.quantity))) : [newLine()],
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Бронювання без замовлення, а під час редагування — ще й власне бронювання замовлення
  const freeReservations = reservations.filter(
    (r) => r.id_order === null || (row && r.id_order === row.id_order),
  );
  const reservationOf = (id) => reservations.find((r) => String(r.id_reservation) === String(id));
  const chosenReservation = reservationOf(values.id_reservation);
  const dishOf = (id) => dishes.find((d) => String(d.id_dish) === String(id));

  const headerFields = [
    {
      name: 'id_reservation',
      label: 'Бронювання',
      type: 'autocomplete',
      options: freeReservations.map((r) => ({
        value: r.id_reservation,
        label:
          `№${r.id_reservation} — ${formatDateTime(r.date_time)}, ${r.visitor.full_name}, ` +
          `столик ${r.table_number} (${r.reservation_status})`,
      })),
      helperText: 'Необов’язково. Порожнє поле — замовлення без бронювання',
    },
    {
      name: 'table_number',
      label: 'Столик',
      type: 'select',
      required: true,
      disabled: Boolean(chosenReservation),
      options: tables.map((t) => ({
        value: t.table_number,
        label: `Столик №${t.table_number} — до ${t.capacity} осіб`,
      })),
      helperText: chosenReservation ? 'Столик береться з бронювання' : undefined,
    },
    {
      name: 'id_waiter',
      label: 'Офіціант',
      type: 'select',
      required: true,
      options: waiters.map((w) => ({ value: w.id_waiter, label: w.full_name })),
    },
    {
      name: 'payment_status',
      label: 'Статус оплати',
      type: 'select',
      required: true,
      options: statuses.map((s) => ({ value: s, label: s })),
    },
    { name: 'tips', label: 'Чайові, грн', type: 'money', helperText: 'Наприклад 0 або 50.00' },
  ];

  const change = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Правило курсової: з бронюванням столик замовлення береться з нього
      if (name === 'id_reservation' && value) {
        next.table_number = String(reservationOf(value).table_number);
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: undefined, table_number: undefined }));
  };

  const changeLine = (index, name, value) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [name]: value } : line)));
    setErrors((prev) => ({
      ...prev,
      [`details[${index}].${name}`]: undefined,
      details: undefined,
    }));
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_line, i) => i !== index));
    setErrors({});
  };

  const totalCents = lines.reduce((sum, line) => {
    const dish = dishOf(line.id_dish);
    const quantity = Number(line.quantity);
    return dish && Number.isInteger(quantity) && quantity > 0
      ? sum + toCents(dish.price) * quantity
      : sum;
  }, 0);

  // Етап 9: знижку визначає сервер; форма показує попередній розрахунок за поточними даними
  const discount = useDiscountPreview({
    id_order: row?.id_order ?? null,
    id_reservation: values.id_reservation || null,
    payment_status: values.payment_status,
    details: lines
      .filter((line) => dishOf(line.id_dish) && /^\d+$/.test(String(line.quantity).trim()))
      .map((line) => ({ id_dish: Number(line.id_dish), quantity: Number(line.quantity) })),
  });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    const body = {
      id_reservation: values.id_reservation || null,
      id_waiter: values.id_waiter,
      table_number: values.id_reservation ? null : values.table_number,
      payment_status: values.payment_status,
      tips: values.tips.replace(',', '.'),
      details: lines.map((line) => ({ id_dish: line.id_dish, quantity: line.quantity })),
    };
    try {
      await onSubmit(body);
    } catch (error) {
      const known = [
        ...headerFields.map((f) => f.name),
        'details',
        ...lines.flatMap((_line, i) => [`details[${i}].id_dish`, `details[${i}].quantity`]),
      ];
      const result = splitApiError(error, known);
      setErrors(result.fieldErrors);
      setFormError(result.formError);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{row ? `Замовлення №${row.id_order}` : 'Нове замовлення'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {headerFields.map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={values[field.name]}
                error={errors[field.name]}
                onChange={change}
              />
            ))}
          </Stack>

          <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 600 }}>
            Позиції замовлення
          </Typography>
          {errors.details && (
            <Alert severity="error" sx={{ my: 1 }}>
              {errors.details}
            </Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Страва</TableCell>
                <TableCell sx={{ width: 160 }}>Кількість</TableCell>
                <TableCell align="right">Ціна</TableCell>
                <TableCell align="right">Сума</TableCell>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, index) => {
                const dish = dishOf(line.id_dish);
                const quantity = Number(line.quantity);
                const taken = new Set(lines.filter((_l, i) => i !== index).map((l) => l.id_dish));
                return (
                  <TableRow key={line.key}>
                    <TableCell sx={{ verticalAlign: 'top', minWidth: 220 }}>
                      <FormField
                        field={{
                          name: 'id_dish',
                          label: 'Страва',
                          type: 'autocomplete',
                          // Страва в замовленні лише один раз (ключ id_order + id_dish)
                          options: dishes
                            .filter((d) => !taken.has(String(d.id_dish)))
                            .map((d) => ({ value: d.id_dish, label: d.title })),
                        }}
                        value={line.id_dish}
                        error={errors[`details[${index}].id_dish`]}
                        onChange={(_name, value) => changeLine(index, 'id_dish', value)}
                      />
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <FormField
                        field={{ name: 'quantity', label: 'К-сть', type: 'number' }}
                        value={line.quantity}
                        error={errors[`details[${index}].quantity`]}
                        onChange={(_name, value) => changeLine(index, 'quantity', value)}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2.5 }}>
                      {dish ? dish.price : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'top', pt: 2.5 }}>
                      {dish && Number.isInteger(quantity) && quantity > 0
                        ? fromCents(toCents(dish.price) * quantity)
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                      <Tooltip title="Прибрати позицію">
                        <IconButton size="small" color="error" onClick={() => removeLine(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">Позицій немає</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setLines((prev) => [...prev, newLine()])}
              disabled={lines.length >= dishes.length}
            >
              Додати страву
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Typography sx={{ fontWeight: 600 }}>
              Разом за меню: {fromCents(totalCents)} грн
            </Typography>
          </Box>
          <DiscountSummary {...discount} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" variant="contained" loading={busy}>
            Зберегти
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
