import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Попередній розрахунок знижки для форми замовлення (етап 9):
// POST /api/orders/discount-preview. Запит іде через 300 мс після останньої зміни форми,
// застарілі відповіді відкидаються. У базі нічого не змінюється.
export function useDiscountPreview(input) {
  const key = JSON.stringify(input);
  // key — для яких даних форми отримано відповідь; поки він інший, розрахунок оновлюється
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.post('/orders/discount-preview', JSON.parse(key)).then(
        (data) => active && setState({ key, data, error: null }),
        (error) => active && setState({ key, data: null, error }),
      );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  return { data: state.data, error: state.error, loading: state.key !== key };
}
