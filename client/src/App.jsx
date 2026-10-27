import { useEffect, useState } from 'react';
import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';

// Мінімальна перевірка працездатності: клієнт звертається до сервера й бази даних
async function fetchStatus(path) {
  try {
    const res = await fetch(path);
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, text: body.error?.message ?? `помилка ${res.status}` };
    }
    // Для бази даних сервер повертає й назву бази, до якої підключився
    return { ok: true, text: body.name ? `працює (${body.name})` : 'працює' };
  } catch {
    return { ok: false, text: 'сервер недоступний' };
  }
}

export default function App() {
  const [server, setServer] = useState(null);
  const [database, setDatabase] = useState(null);

  const check = async () => {
    setServer(await fetchStatus('/api/health'));
    setDatabase(await fetchStatus('/api/health/db'));
  };

  const recheck = () => {
    setServer(null);
    setDatabase(null);
    check();
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const serverStatus = await fetchStatus('/api/health');
      const databaseStatus = await fetchStatus('/api/health/db');
      if (active) {
        setServer(serverStatus);
        setDatabase(databaseStatus);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const row = (label, state) => (
    <Alert severity={state === null ? 'info' : state.ok ? 'success' : 'error'}>
      {label}: {state === null ? 'перевірка…' : state.text}
    </Alert>
  );

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          RestaurantDB
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Стан локального середовища розробки
        </Typography>
        <Stack spacing={2}>
          {row('Клієнт', { ok: true, text: 'працює' })}
          {row('Сервер (API)', server)}
          {row('База даних SQL Server', database)}
          <Button variant="outlined" onClick={recheck}>
            Перевірити ще раз
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
