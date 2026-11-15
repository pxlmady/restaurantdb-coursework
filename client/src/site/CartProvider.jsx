import { useCallback, useEffect, useMemo, useState } from 'react';
import { CartContext } from './cart-context.js';

const STORAGE_KEY = 'restaurant-site-cart';
export const MAX_QUANTITY = 20; // як SITE_RULES.max_quantity на сервері

const load = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
};

// Передзамовлення зберігається у вкладці браузера (sessionStorage), а в базу потрапляє
// лише разом з бронюванням: POST /api/site/bookings
export default function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const setQuantity = useCallback((idDish, quantity) => {
    setItems((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[idDish];
      else next[idDish] = Math.min(quantity, MAX_QUANTITY);
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems({}), []);

  const value = useMemo(
    () => ({
      items,
      count: Object.values(items).reduce((sum, quantity) => sum + quantity, 0),
      setQuantity,
      clear,
    }),
    [items, setQuantity, clear],
  );

  return <CartContext value={value}>{children}</CartContext>;
}
