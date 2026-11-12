import { Box, Paper, Typography } from '@mui/material';

// Підсумкові показники результату запиту: [{ label, value, hint }]
export default function SummaryCards({ items }) {
  if (!items?.length) return null;
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        mb: 2,
      }}
    >
      {items.map((item) => (
        <Paper key={item.label} variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {item.label}
          </Typography>
          <Typography variant="h6" component="p" sx={{ mt: 0.5 }}>
            {item.value ?? '—'}
          </Typography>
          {item.hint && (
            <Typography variant="caption" color="text.secondary">
              {item.hint}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
}
