import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import VisitorsPage from './pages/VisitorsPage.jsx';
import TablesPage from './pages/TablesPage.jsx';
import WaitersPage from './pages/WaitersPage.jsx';
import DishesPage from './pages/DishesPage.jsx';
import ReservationsPage from './pages/ReservationsPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import QueryRoute from './pages/queries/QueryRoute.jsx';
import { QUERY_DEFINITIONS } from './pages/queries/definitions.jsx';

// Маршрути клієнта: кожен розділ меню має власну адресу (/visitors, /orders тощо);
// запити Q1–Q8 — /queries/<endpoint>, як і на сервері (/api/queries/<endpoint>)
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="visitors" element={<VisitorsPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="waiters" element={<WaitersPage />} />
        <Route path="dishes" element={<DishesPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        {QUERY_DEFINITIONS.map((query) => (
          <Route
            key={query.code}
            path={`queries/${query.endpoint}`}
            element={<QueryRoute query={query} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
