import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { api } from '../api/client.js';
import { NAVIGATION } from '../navigation.jsx';

// Стан сервера та бази даних (з етапу 3)
async function fetchStatus(path) {
  try {
    const body = await api.get(path);
    return { ok: true, text: body.name ? `працює (${body.name})` : 'працює' };
  } catch (error) {
    return { ok: false, text: error.message };
  }
}

// Кількість записів у кожному розділі
async function fetchCounts() {
  const paths = ['/visitors', '/tables', '/waiters', '/dishes', '/reservations', '/orders'];
  const lists = await Promise.all(paths.map((p) => api.get(p).catch(() => null)));
  return Object.fromEntries(paths.map((p, i) => [p, lists[i]?.length]));
}

export default function HomePage() {
  const [server, setServer] = useState(null);
  const [database, setDatabase] = useState(null);
  const [counts, setCounts] = useState({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const serverStatus = await fetchStatus('/health');
      const databaseStatus = await fetchStatus('/health/db');
      const listCounts = databaseStatus.ok ? await fetchCounts() : {};
      if (active) {
        setServer(serverStatus);
        setDatabase(databaseStatus);
        setCounts(listCounts);
      }
    })();
    return () => {
      active = false;
    };
  }, [version]);

  const recheck = () => {
    setServer(null);
    setDatabase(null);
    setVersion((v) => v + 1);
  };

  const status = (label, state) => (
    <Alert severity={state === null ? 'info' : state.ok ? 'success' : 'error'}>
      {label}: {state === null ? 'перевірка…' : state.text}
    </Alert>
  );

  const sections = NAVIGATION.flatMap((group) => group.items).filter((item) => item.path !== '/');

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Головна
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Навчальний вебзастосунок для бази даних ресторану: перегляд, додавання, редагування й
        видалення записів через Prisma ORM і SQL Server.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          mb: 4,
        }}
      >
        {sections.map((item) => (
          <Card key={item.path} variant="outlined">
            <CardActionArea component={RouterLink} to={item.path}>
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', color: 'primary.main' }}
                >
                  {item.icon}
                  <Typography variant="subtitle1">{item.label}</Typography>
                </Stack>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {counts[item.path] ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  записів
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Typography variant="h6" component="h2" gutterBottom>
        Стан середовища
      </Typography>
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {status('Клієнт', { ok: true, text: 'працює' })}
        {status('Сервер (API)', server)}
        {status('База даних SQL Server', database)}
        <Button variant="outlined" onClick={recheck} sx={{ alignSelf: 'flex-start' }}>
          Перевірити ще раз
        </Button>
      </Stack>
    </Box>
  );
}
