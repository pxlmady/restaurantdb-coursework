import {
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { formatDateTime, formatMoney, STATUS_COLORS } from '../lib/format.js';
import { peopleLabel } from './site-format.js';

function Fact({ label, children }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
    </Box>
  );
}

// Бронювання відвідувача з передзамовленням: відповідь POST /api/site/bookings
// або елемент списку GET /api/site/bookings. actions — кнопки під карткою.
export default function BookingCard({ booking, actions }) {
  const { order } = booking;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}
      >
        <Typography variant="h6" component="h3">
          Бронювання №{booking.id_reservation}
        </Typography>
        <Chip
          label={booking.reservation_status}
          color={STATUS_COLORS[booking.reservation_status] ?? 'default'}
          size="small"
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        }}
      >
        <Fact label="Дата й час">{formatDateTime(booking.date_time)}</Fact>
        <Fact label="Гостей">{peopleLabel(booking.people_count)}</Fact>
        <Fact label="Столик">
          №{booking.table_number} (до {peopleLabel(booking.table_capacity)})
        </Fact>
        <Fact label="На ім’я">{booking.visitor.full_name}</Fact>
      </Box>

      {order && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Передзамовлення №{order.id_order}
            </Typography>
            <Chip
              label={order.payment_status}
              color={STATUS_COLORS[order.payment_status] ?? 'default'}
              size="small"
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary">
              офіціант: {order.waiter}
            </Typography>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Страва</TableCell>
                  <TableCell align="right">Ціна</TableCell>
                  <TableCell align="right">Порцій</TableCell>
                  <TableCell align="right">Сума</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.details.map((line) => (
                  <TableRow key={line.id_dish}>
                    <TableCell>{line.title}</TableCell>
                    <TableCell align="right">{formatMoney(line.price)}</TableCell>
                    <TableCell align="right">{line.quantity}</TableCell>
                    <TableCell align="right">{formatMoney(line.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <Stack sx={{ alignItems: 'flex-end', mt: 1.5 }}>
            {order.discount_percent > 0 && (
              <>
                <Typography variant="body2">Разом за меню: {formatMoney(order.total)}</Typography>
                <Typography variant="body2" color="secondary">
                  Знижка {order.discount_percent} %: −{formatMoney(order.discount_amount)}
                </Typography>
              </>
            )}
            <Typography sx={{ fontWeight: 700 }}>
              До сплати: {formatMoney(order.total_due)}
            </Typography>
          </Stack>
        </>
      )}

      {actions && (
        <Stack direction="row" sx={{ gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {actions}
        </Stack>
      )}
    </Paper>
  );
}
