import { Link as RouterLink, NavLink, Outlet } from 'react-router';
import { ThemeProvider } from '@mui/material/styles';
import { Badge, Box, Button, Container, Link, Stack, Typography } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/RestaurantMenu';
import { siteTheme } from './siteTheme.js';
import CartProvider from './CartProvider.jsx';
import { useCart } from './cart-context.js';
import { SITE } from './site-config.js';
import { useApiData } from '../hooks/useApiData.js';
import { hoursLabel } from './site-format.js';

const LINKS = [
  { to: '/site', label: 'Головна', end: true },
  { to: '/site/menu', label: 'Меню' },
  { to: '/site/booking', label: 'Бронювання', cart: true },
  { to: '/site/my', label: 'Мої бронювання' },
];

// Смуга з орнаментом (client/public/site/ornament.svg)
const Ornament = () => (
  <Box
    aria-hidden
    sx={{ height: 12, backgroundImage: 'url(/site/ornament.svg)', backgroundSize: 'auto 12px' }}
  />
);

function Header() {
  const { count } = useCart();
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 'appBar',
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Ornament />
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1, gap: 1 }}
        >
          <Link
            component={RouterLink}
            to="/site"
            underline="none"
            color="primary"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <RestaurantIcon />
            <Typography variant="h5" component="span">
              {SITE.name}
            </Typography>
          </Link>
          <Stack
            component="nav"
            direction="row"
            sx={{ gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {LINKS.map((link) => (
              <Button
                key={link.to}
                component={NavLink}
                to={link.to}
                end={link.end}
                color="inherit"
                size="small"
                sx={{ '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText' } }}
              >
                {link.cart ? (
                  <Badge
                    badgeContent={count}
                    color="secondary"
                    sx={{ '& .MuiBadge-badge': { right: -10 } }}
                  >
                    {link.label}
                  </Badge>
                ) : (
                  link.label
                )}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function Footer() {
  const { data: info } = useApiData('/site/info');
  return (
    <Box
      component="footer"
      sx={{ mt: 6, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
    >
      <Ornament />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{ justifyContent: 'space-between', gap: 3 }}
        >
          <Box>
            <Typography variant="h6">{SITE.name}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {SITE.tagline}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2">{SITE.address}</Typography>
            <Typography variant="body2">{SITE.phone}</Typography>
            {info && <Typography variant="body2">{hoursLabel(info.rules)}</Typography>}
          </Box>
          <Box>
            <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 320 }}>
              Навчальний проєкт: сайт працює з базою даних RestaurantDB через Prisma ORM.
            </Typography>
            <Link component={RouterLink} to="/" color="inherit" variant="body2">
              Перейти до адмін-панелі
            </Link>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

// Каркас сайту ресторану: власна тема, шапка з навігацією, підвал.
// Адмін-панель (components/Layout.jsx) лишається за адресою «/».
export default function SiteLayout() {
  return (
    <ThemeProvider theme={siteTheme}>
      <CartProvider>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            color: 'text.primary',
          }}
        >
          <Header />
          <Box component="main" sx={{ flexGrow: 1 }}>
            <Outlet />
          </Box>
          <Footer />
        </Box>
      </CartProvider>
    </ThemeProvider>
  );
}
