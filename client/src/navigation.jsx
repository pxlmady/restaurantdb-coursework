import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import EventSeatIcon from '@mui/icons-material/EventSeatOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import { Typography } from '@mui/material';
import { QUERY_DEFINITIONS } from './pages/queries/definitions.jsx';

// Розділи бічного меню. Група «Запити» (етап 8) будується з описів запитів Q1–Q8;
// замість іконки в ній показано номер запиту.
export const NAVIGATION = [
  {
    items: [
      { path: '/', label: 'Головна', icon: <DashboardIcon /> },
      // Сайт для відвідувачів (етап 10) має власний каркас; на головній картки для нього немає
      { path: '/site', label: 'Сайт ресторану', icon: <StorefrontIcon />, external: true },
    ],
  },
  {
    title: 'Довідники',
    items: [
      { path: '/visitors', label: 'Відвідувачі', icon: <PeopleIcon /> },
      { path: '/tables', label: 'Столики', icon: <EventSeatIcon /> },
      { path: '/waiters', label: 'Офіціанти', icon: <BadgeIcon /> },
      { path: '/dishes', label: 'Меню (страви)', icon: <RestaurantMenuIcon /> },
    ],
  },
  {
    title: 'Робота ресторану',
    items: [
      { path: '/reservations', label: 'Бронювання', icon: <EventIcon /> },
      { path: '/orders', label: 'Замовлення', icon: <ReceiptIcon /> },
    ],
  },
  {
    title: 'Запити',
    queries: true,
    items: QUERY_DEFINITIONS.map((query) => ({
      path: `/queries/${query.endpoint}`,
      label: query.title,
      query,
      icon: (
        <Typography
          variant="body2"
          component="span"
          sx={{ fontWeight: 700, color: 'primary.main' }}
        >
          {query.code}
        </Typography>
      ),
    })),
  },
];
