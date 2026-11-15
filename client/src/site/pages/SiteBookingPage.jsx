import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/CheckCircleOutlined';
import { api, splitApiError } from '../../api/client.js';
import { useApiData } from '../../hooks/useApiData.js';
import { formatMoney } from '../../lib/format.js';
import BookingCard from '../BookingCard.jsx';
import { useCart } from '../cart-context.js';
import QuantityStepper from '../QuantityStepper.jsx';
import {
  bookingTimes,
  defaultDate,
  isPhone,
  normalizePhone,
  peopleLabel,
  PHONE_HINT,
  savePhone,
  today,
} from '../site-format.js';
import { useSiteRequest } from '../useSiteRequest.js';

const DEFAULT_TIME = '19:00';
const FIELDS = ['full_name', 'phone_number', 'date_time', 'people_count'];

// Повідомлення про вільний столик: GET /api/site/availability після кожної зміни форми
function Availability({ state, people }) {
  if (state.loading) return <LinearProgress />;
  if (state.error) {
    // Наприклад: час уже минув або поза годинами бронювання (пояснення в details)
    const detail = state.error.details?.find((item) => item.message);
    return <Alert severity="warning">{detail?.message ?? state.error.message}</Alert>;
  }
  if (!state.data) return null;
  if (state.data.available) {
    return (
      <Alert severity="success">
        Є вільний столик №{state.data.table.table_number} (до{' '}
        {peopleLabel(state.data.table.capacity)}). Він буде вашим на 2 години.
      </Alert>
    );
  }
  return (
    <Alert severity="warning">
      {state.data.reason === 'too_many_people'
        ? `Найбільший столик розрахований на ${peopleLabel(state.data.max_people)}, а гостей ${people}. Для більшої компанії зателефонуйте нам.`
        : 'На цей час вільних столиків для такої компанії немає. Спробуйте інший час або дату.'}
    </Alert>
  );
}

// Пояснення правила знижки для відвідувача. Постійного гостя сервер визначає за телефоном,
// тому поки номера немає в базі, показуємо підказку замість службового тексту.
const ruleText = (rule, preview) =>
  rule.code === 'regular' && !preview.known_visitor
    ? 'діє від 3 оплачених замовлень за вашим номером телефону'
    : rule.text;

// Передзамовлення: вибрані страви, сума і знижка (POST /api/site/preview)
function Preorder({ lines, preview }) {
  const { setQuantity } = useCart();
  if (lines.length === 0) {
    return (
      <Box>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          Страви можна не замовляти заздалегідь. Якщо хочете, щоб вечеря вже чекала на вас, додайте
          страви з меню.
        </Typography>
        <Button component={RouterLink} to="/site/menu" variant="outlined">
          Вибрати страви
        </Button>
      </Box>
    );
  }
  const { data, error, loading } = preview;
  const applied = data?.rules.find((rule) => rule.code === data.applied);
  return (
    <Box>
      <Stack divider={<Divider flexItem />} sx={{ gap: 1 }}>
        {lines.map(({ dish, quantity }) => (
          <Stack key={dish.id_dish} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 600 }}>
                {dish.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatMoney(dish.price)} × {quantity} ={' '}
                {formatMoney((Number(dish.price) * quantity).toFixed(2))}
              </Typography>
            </Box>
            <QuantityStepper
              value={quantity}
              title={dish.title}
              onChange={(value) => setQuantity(dish.id_dish, value)}
            />
            <IconButton
              size="small"
              aria-label={`Прибрати: ${dish.title}`}
              onClick={() => setQuantity(dish.id_dish, 0)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button component={RouterLink} to="/site/menu" size="small" sx={{ mt: 1 }}>
        Додати ще страви
      </Button>
      <Divider sx={{ my: 1.5 }} />
      {error && (
        <Alert severity="warning">
          Не вдалося розрахувати суму: {error.message}. Остаточно її визначить сервер.
        </Alert>
      )}
      {!data && !error && <LinearProgress />}
      {data && (
        <Stack sx={{ gap: 0.5, opacity: loading ? 0.6 : 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography>Разом за меню</Typography>
            <Typography>{formatMoney(data.total)}</Typography>
          </Stack>
          {data.discount_percent > 0 && (
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', color: 'secondary.main' }}
            >
              <Typography>
                Знижка {data.discount_percent} % ({applied?.title.toLowerCase()})
              </Typography>
              <Typography>−{formatMoney(data.discount_amount)}</Typography>
            </Stack>
          )}
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" component="span">
              До сплати
            </Typography>
            <Typography variant="h6" component="span" color="primary">
              {formatMoney(data.total_due)}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {data.rules
              .map((rule) => `${rule.title}, ${rule.percent} %: ${ruleText(rule, data)}`)
              .join('. ')}
            . Знижки не сумуються. Оплата — у ресторані.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

// Бронювання столика з передзамовленням: POST /api/site/bookings.
// Відвідувач вказує лише ім'я, телефон, час і кількість гостей; столик підбирає сервер.
export default function SiteBookingPage() {
  const { data: info, error: infoError } = useApiData('/site/info');
  const { data: menu } = useApiData('/site/menu');
  const { items, clear } = useCart();
  const [form, setForm] = useState({
    date: defaultDate(DEFAULT_TIME),
    time: DEFAULT_TIME,
    people_count: '2',
    full_name: '',
    phone_number: '+380',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const set = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    const errorField = field === 'date' || field === 'time' ? 'date_time' : field;
    setErrors((prev) => ({ ...prev, [errorField]: undefined }));
  };

  const people = Number(form.people_count);
  const dateTime = form.date && form.time ? `${form.date}T${form.time}` : null;
  const slotReady = Boolean(dateTime) && Number.isInteger(people) && people >= 1;
  const availability = useSiteRequest(
    slotReady && !result
      ? {
          method: 'get',
          path: `/site/availability?${new URLSearchParams({ date_time: dateTime, people_count: people })}`,
        }
      : null,
  );

  // Страви з передзамовлення, яких уже немає в меню, не показуємо і не надсилаємо
  const lines = (menu ?? [])
    .filter((dish) => items[dish.id_dish])
    .map((dish) => ({ dish, quantity: items[dish.id_dish] }));
  const details = lines.map(({ dish, quantity }) => ({ id_dish: dish.id_dish, quantity }));
  const preview = useSiteRequest(
    details.length > 0 && !result
      ? {
          method: 'post',
          path: '/site/preview',
          body: {
            phone_number: isPhone(form.phone_number)
              ? normalizePhone(form.phone_number)
              : undefined,
            details,
          },
        }
      : null,
  );

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const booking = await api.post('/site/bookings', {
        full_name: form.full_name,
        phone_number: form.phone_number,
        date_time: dateTime,
        people_count: form.people_count,
        details,
      });
      savePhone(booking.visitor.phone_number);
      clear();
      setResult(booking);
      window.scrollTo({ top: 0 });
    } catch (error) {
      const split = splitApiError(error, FIELDS);
      setErrors(split.fieldErrors);
      setFormError(split.formError);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 1 }}>
          <CheckIcon color="success" fontSize="large" />
          <Typography variant="h3" component="h1">
            Столик заброньовано
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {result.visitor_is_new
            ? 'Дякуємо! Ми запам’ятали ваш номер телефону: за ним можна переглянути або скасувати бронювання.'
            : `Раді бачити вас знову, ${result.visitor.full_name}! Бронювання додано до вашого номера телефону.`}
        </Typography>
        <BookingCard
          booking={result}
          actions={
            <>
              <Button component={RouterLink} to="/site/my" variant="contained">
                Мої бронювання
              </Button>
              <Button onClick={() => setResult(null)}>Ще одне бронювання</Button>
              <Button component={RouterLink} to="/site">
                На головну
              </Button>
            </>
          }
        />
      </Container>
    );
  }

  const times = info ? bookingTimes(info.rules) : [form.time];
  const cannotBook = availability.data ? !availability.data.available : Boolean(availability.error);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Бронювання столика
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Столик бронюється на 2 години.
        {info &&
          ` Бронювання приймаємо на час з ${times[0]} до ${times.at(-1)}, компанії до ${peopleLabel(info.max_people)}.`}
      </Typography>
      {infoError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {infoError.message}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={submit}
        noValidate
        sx={{
          display: 'grid',
          gap: 3,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            Коли і скільки гостей
          </Typography>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField
                label="Дата"
                type="date"
                required
                fullWidth
                value={form.date}
                onChange={set('date')}
                error={Boolean(errors.date_time)}
                helperText={errors.date_time}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today() } }}
              />
              <TextField
                select
                label="Час"
                required
                fullWidth
                value={times.includes(form.time) ? form.time : ''}
                onChange={set('time')}
                error={Boolean(errors.date_time)}
              >
                {times.map((time) => (
                  <MenuItem key={time} value={time}>
                    {time}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Гостей"
                type="number"
                required
                fullWidth
                value={form.people_count}
                onChange={set('people_count')}
                error={Boolean(errors.people_count)}
                helperText={errors.people_count}
                slotProps={{ htmlInput: { min: 1, max: info?.max_people } }}
              />
            </Stack>
            <Availability state={availability} people={people} />

            <Typography variant="h5" component="h2" sx={{ mt: 1 }}>
              Ваші контакти
            </Typography>
            <TextField
              label="Ім’я та прізвище"
              required
              value={form.full_name}
              onChange={set('full_name')}
              error={Boolean(errors.full_name)}
              helperText={errors.full_name}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <TextField
              label="Телефон"
              type="tel"
              required
              value={form.phone_number}
              onChange={set('phone_number')}
              error={Boolean(errors.phone_number)}
              helperText={
                errors.phone_number ??
                `${PHONE_HINT}. Якщо ви вже були в нас, вкажіть той самий номер — врахуємо знижку постійного гостя.`
              }
            />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            Передзамовлення
          </Typography>
          <Preorder lines={lines} preview={preview} />
          <Divider sx={{ my: 2 }} />
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            loading={busy}
            disabled={cannotBook}
          >
            {details.length > 0 ? 'Забронювати і замовити страви' : 'Забронювати столик'}
          </Button>
        </Paper>
      </Box>
    </Container>
  );
}
