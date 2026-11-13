import { Alert, Box, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircleOutlined';
import CloseIcon from '@mui/icons-material/CancelOutlined';
import { formatMoney } from '../lib/format.js';

// Блок знижки у формі замовлення: які правила виконано, відсоток, сума знижки й до сплати.
// Дані — відповідь POST /api/orders/discount-preview (див. hooks/useDiscountPreview.js).
export default function DiscountSummary({ data, error, loading }) {
  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Не вдалося розрахувати знижку: {error.message}. Під час збереження її визначить сервер.
      </Alert>
    );
  }
  if (!data) return <LinearProgress sx={{ mt: 2 }} />;

  const applied = data.rules.find((rule) => rule.code === data.applied);
  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2, opacity: loading ? 0.6 : 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Знижка
      </Typography>
      {data.frozen ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          Замовлення закрите, тому знижку {data.discount_percent} % зафіксовано: зміни позицій і
          нові замовлення відвідувача її не змінюють.
        </Alert>
      ) : (
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {data.rules.map((rule) => (
            <Box key={rule.code} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              {rule.met ? (
                <CheckIcon fontSize="small" color="success" />
              ) : (
                <CloseIcon fontSize="small" color="disabled" />
              )}
              <Typography variant="body2">
                <b>
                  {rule.title}, {rule.percent} %
                </b>{' '}
                — <span>{rule.text}</span>
              </Typography>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            Знижки не сумуються: застосовується більша. Остаточно знижку визначає сервер під час
            збереження.
          </Typography>
        </Stack>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
        <Typography variant="body2">Разом за меню: {formatMoney(data.total)}</Typography>
        <Typography variant="body2">
          Знижка{' '}
          {data.discount_percent > 0
            ? `${data.discount_percent} %${applied ? ` (${applied.title.toLowerCase()})` : ''}: −${formatMoney(data.discount_amount)}`
            : ': немає'}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontWeight: 600 }}>До сплати: {formatMoney(data.total_due)}</Typography>
      </Box>
    </Paper>
  );
}
