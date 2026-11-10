import { useCallback, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { NotifyContext } from '../lib/notify-context.js';

// Показує повідомлення про результат операції в нижньому куті екрана
export default function NotificationProvider({ children }) {
  const [message, setMessage] = useState(null);

  const notify = useCallback((text, severity = 'success') => {
    setMessage({ text, severity, key: Date.now() });
  }, []);

  const close = (_event, reason) => {
    if (reason !== 'clickaway') setMessage(null);
  };

  return (
    <NotifyContext value={notify}>
      {children}
      <Snackbar
        key={message?.key}
        open={message !== null}
        autoHideDuration={message?.severity === 'error' ? 8000 : 4000}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {message ? (
          <Alert severity={message.severity} variant="filled" onClose={close}>
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext>
  );
}
