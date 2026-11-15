import { createContext, useContext } from 'react';

// Передзамовлення відвідувача: { items: { [id_dish]: кількість }, count, setQuantity, clear }.
// Стан тримає CartProvider.jsx; сторінки меню й бронювання працюють з ним через useCart().
export const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);
