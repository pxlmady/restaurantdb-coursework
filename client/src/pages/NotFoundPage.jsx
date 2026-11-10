import { Link as RouterLink } from 'react-router';
import { Button, Stack, Typography } from '@mui/material';

export default function NotFoundPage() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h5" component="h1">
        Сторінку не знайдено
      </Typography>
      <Button component={RouterLink} to="/" variant="outlined">
        На головну
      </Button>
    </Stack>
  );
}
