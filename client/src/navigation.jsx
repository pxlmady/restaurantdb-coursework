import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import EventSeatIcon from '@mui/icons-material/EventSeatOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';

// Розділи бічного меню. Сторінки запитів (етап 8) додаються окремою групою.
export const NAVIGATION = [
  {
    items: [{ path: '/', label: 'Головна', icon: <DashboardIcon /> }],
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
];
