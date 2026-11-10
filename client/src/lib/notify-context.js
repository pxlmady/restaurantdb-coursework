import { createContext, useContext } from 'react';

// Спільні повідомлення про результат операцій (Snackbar), див. components/NotificationProvider.jsx
export const NotifyContext = createContext(() => {});

// notify('Збережено') або notify('Помилка', 'error')
export const useNotify = () => useContext(NotifyContext);
