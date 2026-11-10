import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { splitApiError } from '../api/client.js';
import FormField from './FormField.jsx';

// Діалог створення або редагування запису.
// fields — масив описів полів або функція (values) => масив (якщо поля залежать від значень).
// onSubmit(values) надсилає дані на сервер; помилки сервера показуються біля відповідних полів.
export default function FormDialog({ title, fields, initialValues, onSubmit, onClose }) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = typeof fields === 'function' ? fields(values) : fields;

  const change = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const result = splitApiError(
        error,
        list.map((f) => f.name),
      );
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {list.map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={values[field.name]}
                error={fieldErrors[field.name]}
                onChange={change}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" variant="contained" loading={busy}>
            Зберегти
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
