import { IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { MAX_QUANTITY } from './CartProvider.jsx';

// Кнопки «−» і «+» з кількістю порцій між ними; 0 прибирає страву з передзамовлення
export default function QuantityStepper({ value, onChange, title }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <IconButton
        size="small"
        color="primary"
        aria-label={`Менше: ${title}`}
        onClick={() => onChange(value - 1)}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{value}</Typography>
      <IconButton
        size="small"
        color="primary"
        aria-label={`Більше: ${title}`}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
