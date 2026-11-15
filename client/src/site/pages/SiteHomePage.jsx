import { Link as RouterLink } from 'react-router';
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import EventSeatIcon from '@mui/icons-material/EventSeatOutlined';
import RestaurantIcon from '@mui/icons-material/RestaurantOutlined';
import PercentIcon from '@mui/icons-material/PercentOutlined';
import { useApiData } from '../../hooks/useApiData.js';
import DishCard from '../DishCard.jsx';
import { dishImage, SITE } from '../site-config.js';
import { hoursLabel } from '../site-format.js';

const HERO_DISHES = ['Борщ', 'Вареники з вишнею', 'Качка з яблуками'];

function Feature({ icon, title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
      <Box sx={{ color: 'primary.main', mb: 1 }}>{icon}</Box>
      <Typography variant="h6" component="h3" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary">{children}</Typography>
    </Paper>
  );
}

// Головна сторінка сайту: вітання, переваги, популярні страви (GET /api/site/menu, popular)
export default function SiteHomePage() {
  const { data: menu, error } = useApiData('/site/menu');
  const { data: info } = useApiData('/site/info');
  const popular = menu?.filter((dish) => dish.popular) ?? [];
  const rules = info?.discount_rules ?? [];

  return (
    <>
      <Box
        sx={{
          color: '#fffaf2',
          background: 'linear-gradient(120deg, #24392a 0%, #35543c 55%, #5c2a1f 100%)',
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{ alignItems: 'center', gap: 4, py: { xs: 5, md: 8 } }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" sx={{ letterSpacing: 3, opacity: 0.85 }}>
                {SITE.tagline}
              </Typography>
              <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 44, md: 64 }, mb: 2 }}>
                {SITE.name}
              </Typography>
              <Typography sx={{ fontSize: 18, opacity: 0.9, maxWidth: 480, mb: 3 }}>
                Борщ із пампушками, вареники, банош і качка з яблуками. Забронюйте столик онлайн і
                замовте страви заздалегідь, щоб вечеря чекала на вас.
              </Typography>
              <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
                <Button
                  component={RouterLink}
                  to="/site/booking"
                  variant="contained"
                  size="large"
                  sx={{ bgcolor: '#fffaf2', color: '#5c2a1f', '&:hover': { bgcolor: '#f3e6d0' } }}
                >
                  Забронювати столик
                </Button>
                <Button
                  component={RouterLink}
                  to="/site/menu"
                  variant="outlined"
                  size="large"
                  sx={{ color: '#fffaf2', borderColor: '#fffaf2' }}
                >
                  Переглянути меню
                </Button>
              </Stack>
            </Box>
            <Stack
              direction="row"
              sx={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }}
              aria-hidden
            >
              {HERO_DISHES.map((title, index) => (
                <Box
                  key={title}
                  component="img"
                  src={dishImage(title)}
                  alt=""
                  sx={{
                    width: { xs: 120, sm: 170, md: 190 },
                    height: { xs: 120, sm: 170, md: 190 },
                    flexShrink: 0,
                    objectFit: 'cover',
                    borderRadius: '50%',
                    border: '4px solid #fffaf2',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    ml: index === 0 ? 0 : { xs: -3, md: -5 },
                    mt: index === 1 ? { xs: 4, md: 7 } : 0,
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            mb: 6,
          }}
        >
          <Feature icon={<EventSeatIcon fontSize="large" />} title="Столик за хвилину">
            Вкажіть дату, час і кількість гостей. Ми самі підберемо вільний столик потрібного
            розміру{info ? ` (до ${info.max_people} осіб)` : ''}.
          </Feature>
          <Feature icon={<RestaurantIcon fontSize="large" />} title="Страви заздалегідь">
            Додайте страви з меню до бронювання. Офіціант отримає ваше передзамовлення ще до вашого
            приходу.
          </Feature>
          <Feature icon={<PercentIcon fontSize="large" />} title="Знижки гостям">
            {rules.length > 0
              ? rules.map((rule) => `${rule.percent} % — ${rule.description}`).join('; ') +
                '. Знижки не сумуються: діє більша.'
              : 'Постійним гостям і великим компаніям — знижка.'}
          </Feature>
        </Box>

        <Stack
          direction="row"
          sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 2, gap: 2 }}
        >
          <Typography variant="h4" component="h2">
            Обирають найчастіше
          </Typography>
          <Button component={RouterLink} to="/site/menu">
            Усе меню
          </Button>
        </Stack>
        {error && <Alert severity="error">Не вдалося завантажити меню: {error.message}</Alert>}
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {popular.map((dish) => (
            <DishCard key={dish.id_dish} dish={dish} />
          ))}
        </Box>

        <Paper
          variant="outlined"
          sx={{ mt: 6, p: { xs: 3, md: 4 }, display: 'flex', flexWrap: 'wrap', gap: 3 }}
        >
          <Box sx={{ flex: '1 1 280px' }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Чекаємо на вас
            </Typography>
            <Typography color="text.secondary">{SITE.address}</Typography>
            <Typography color="text.secondary">{SITE.phone}</Typography>
            {info && <Typography color="text.secondary">{hoursLabel(info.rules)}</Typography>}
          </Box>
          <Stack sx={{ justifyContent: 'center' }}>
            <Button component={RouterLink} to="/site/booking" variant="contained" size="large">
              Забронювати столик
            </Button>
          </Stack>
        </Paper>
      </Container>
    </>
  );
}
