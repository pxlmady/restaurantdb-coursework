import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Button,
  Container,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../../api/client.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { formatDateTime } from '../../lib/format.js';
import BookingCard from '../BookingCard.jsx';
import { isPhone, normalizePhone, PHONE_HINT, savedPhone, savePhone } from '../site-format.js';

// «Мої бронювання»: пошук за номером телефону (GET /api/site/bookings?phone_number=...)
// і скасування активного бронювання (POST /api/site/bookings/:id/cancel).
export default function SiteMyBookingsPage() {
  const [phone, setPhone] = useState(() => savedPhone() || '+380');
  const [state, setState] = useState({ loading: false, error: null, data: null, phone: null });
  const [cancelling, setCancelling] = useState(null);
  const [message, setMessage] = useState(null);

  const search = async (value = phone) => {
    const phoneNumber = normalizePhone(value);
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.get(
        `/site/bookings?${new URLSearchParams({ phone_number: phoneNumber })}`,
      );
      savePhone(phoneNumber);
      setState({ loading: false, error: null, data, phone: phoneNumber });
    } catch (error) {
      setState({ loading: false, error, data: null, phone: null });
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setMessage(null);
    search();
  };

  const cancel = async () => {
    try {
      await api.post(`/site/bookings/${cancelling.id_reservation}/cancel`, {
        phone_number: state.phone,
      });
      setMessage({
        severity: 'success',
        text: `Бронювання №${cancelling.id_reservation} скасовано`,
      });
    } catch (error) {
      setMessage({ severity: 'error', text: error.message });
    }
    setCancelling(null);
    await search(state.phone);
  };

  const { data } = state;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Мої бронювання
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Введіть номер телефону, який ви вказували під час бронювання.
      </Typography>

      <Stack
        component="form"
        onSubmit={submit}
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 2, alignItems: 'flex-start', mb: 3 }}
      >
        <TextField
          label="Телефон"
          type="tel"
          size="small"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          helperText={PHONE_HINT}
          sx={{ minWidth: 260 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!isPhone(phone)}
          loading={state.loading}
        >
          Знайти
        </Button>
      </Stack>

      {state.loading && <LinearProgress sx={{ mb: 2 }} />}
      {state.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {state.error.message}
        </Alert>
      )}
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {data && data.bookings.length === 0 && (
        <Alert
          severity="info"
          action={
            <Button component={RouterLink} to="/site/booking" color="inherit" size="small">
              Забронювати
            </Button>
          }
        >
          {data.visitor
            ? `${data.visitor.full_name}, у вас поки немає бронювань.`
            : 'За цим номером бронювань не знайдено.'}
        </Alert>
      )}
      {data && data.bookings.length > 0 && (
        <>
          <Typography sx={{ mb: 2 }}>
            {data.visitor.full_name}, бронювань: <b>{data.bookings.length}</b>
          </Typography>
          <Stack sx={{ gap: 2 }}>
            {data.bookings.map((booking) => (
              <BookingCard
                key={booking.id_reservation}
                booking={booking}
                actions={
                  booking.can_cancel && (
                    <Button color="error" variant="outlined" onClick={() => setCancelling(booking)}>
                      Скасувати бронювання
                    </Button>
                  )
                }
              />
            ))}
          </Stack>
        </>
      )}

      {cancelling && (
        <ConfirmDialog
          title={`Скасувати бронювання №${cancelling.id_reservation}?`}
          text={
            `Столик №${cancelling.table_number} на ${formatDateTime(cancelling.date_time)} звільниться.` +
            (cancelling.order ? ' Передзамовлення теж буде скасовано.' : '')
          }
          confirmLabel="Так, скасувати"
          onConfirm={cancel}
          onClose={() => setCancelling(null)}
        />
      )}
    </Container>
  );
}
