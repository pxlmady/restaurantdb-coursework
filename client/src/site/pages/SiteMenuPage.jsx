import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Container,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useApiData } from '../../hooks/useApiData.js';
import { formatMoney } from '../../lib/format.js';
import { useCart } from '../cart-context.js';
import DishCard from '../DishCard.jsx';

const SORTS = [
  { value: 'menu', label: 'Як у меню', compare: (a, b) => a.id_dish - b.id_dish },
  { value: 'popular', label: 'Спочатку популярні', compare: (a, b) => b.popular - a.popular },
  { value: 'cheap', label: 'Спочатку дешевші', compare: (a, b) => a.price - b.price },
  { value: 'expensive', label: 'Спочатку дорожчі', compare: (a, b) => b.price - a.price },
];

// Меню ресторану: картки страв з пошуком за назвою і сортуванням.
// Дані — GET /api/site/menu (таблиця Dish). Вибрані страви потрапляють у передзамовлення.
export default function SiteMenuPage() {
  const { data: menu, error, loading } = useApiData('/site/menu');
  const { items, count } = useCart();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('menu');

  const dishes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const { compare } = SORTS.find((s) => s.value === sort);
    return (menu ?? [])
      .filter((dish) => dish.title.toLowerCase().includes(needle))
      .sort((a, b) => compare(a, b) || a.id_dish - b.id_dish);
  }, [menu, search, sort]);

  const total = (menu ?? []).reduce(
    (sum, dish) => sum + Number(dish.price) * (items[dish.id_dish] ?? 0),
    0,
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: count > 0 ? 12 : 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Меню
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Додайте страви до передзамовлення, і вони чекатимуть на вас до призначеного часу. Оплата — у
        ресторані.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mb: 3 }}>
        <TextField
          label="Пошук страви"
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1, maxWidth: { sm: 360 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Сортування"
          size="small"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          sx={{ minWidth: 220 }}
        >
          {SORTS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">Не вдалося завантажити меню: {error.message}</Alert>}
      {menu && dishes.length === 0 && (
        <Alert severity="info">
          {menu.length === 0 ? 'У меню поки немає страв.' : 'За цим запитом страв не знайдено.'}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {dishes.map((dish) => (
          <DishCard key={dish.id_dish} dish={dish} />
        ))}
      </Box>

      {count > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: '50%',
            bottom: 16,
            transform: 'translateX(-50%)',
            width: 'min(640px, calc(100% - 32px))',
            px: 3,
            py: 1.5,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography>
            У передзамовленні порцій: <b>{count}</b>, на суму <b>{formatMoney(total.toFixed(2))}</b>
          </Typography>
          <Button component={RouterLink} to="/site/booking" variant="contained">
            До бронювання
          </Button>
        </Paper>
      )}
    </Container>
  );
}
