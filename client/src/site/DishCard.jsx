import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { formatMoney } from '../lib/format.js';
import { useCart } from './cart-context.js';
import { dishImage, PLACEHOLDER_IMAGE } from './site-config.js';
import QuantityStepper from './QuantityStepper.jsx';

// Картка страви в меню сайту: ілюстрація, назва, вага, ціна і додавання до передзамовлення
export default function DishCard({ dish }) {
  const { items, setQuantity } = useCart();
  const quantity = items[dish.id_dish] ?? 0;

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          component="img"
          src={dishImage(dish.title)}
          alt={dish.title}
          loading="lazy"
          onError={(event) => {
            if (!event.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) {
              event.currentTarget.src = PLACEHOLDER_IMAGE;
            }
          }}
          sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }}
        />
        {dish.popular && (
          <Chip
            label="Обирають найчастіше"
            color="secondary"
            size="small"
            sx={{ position: 'absolute', top: 12, left: 12 }}
          />
        )}
      </Box>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 1 }}>
        <Typography variant="h6" component="h3">
          {dish.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {dish.weight_grams} г
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}
        >
          <Typography variant="h6" component="span" color="primary">
            {formatMoney(dish.price)}
          </Typography>
          {quantity > 0 ? (
            <QuantityStepper
              value={quantity}
              title={dish.title}
              onChange={(value) => setQuantity(dish.id_dish, value)}
            />
          ) : (
            <Button
              variant="outlined"
              size="small"
              aria-label={`Додати до передзамовлення: ${dish.title}`}
              onClick={() => setQuantity(dish.id_dish, 1)}
            >
              Додати
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
