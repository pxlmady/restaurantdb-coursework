import { Autocomplete, MenuItem, TextField } from '@mui/material';

// Одне поле форми за описом:
// { name, label, type: 'text' | 'number' | 'money' | 'datetime' | 'select' | 'autocomplete',
//   options: [{ value, label }], required, disabled, helperText, autoFocus, min }
export default function FormField({ field, value, error, onChange }) {
  const common = {
    name: field.name,
    label: field.label,
    required: field.required,
    disabled: field.disabled,
    autoFocus: field.autoFocus,
    error: Boolean(error),
    helperText: error || field.helperText || ' ',
    fullWidth: true,
    size: 'small',
  };

  if (field.type === 'autocomplete') {
    const selected = field.options.find((o) => String(o.value) === String(value)) ?? null;
    return (
      <Autocomplete
        options={field.options}
        value={selected}
        disabled={field.disabled}
        onChange={(_event, option) => onChange(field.name, option ? String(option.value) : '')}
        isOptionEqualToValue={(option, current) => option.value === current.value}
        getOptionLabel={(option) => option.label}
        noOptionsText="Нічого не знайдено"
        renderInput={(params) => <TextField {...params} {...common} disabled={field.disabled} />}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <TextField
        {...common}
        select
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        {field.options.map((option) => (
          <MenuItem key={option.value} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const typeProps = {
    number: { type: 'number', slotProps: { htmlInput: { min: field.min ?? 1, step: 1 } } },
    money: { slotProps: { htmlInput: { inputMode: 'decimal' } } },
    datetime: { type: 'datetime-local', slotProps: { inputLabel: { shrink: true } } },
  }[field.type] ?? { slotProps: { htmlInput: { maxLength: field.maxLength } } };

  return (
    <TextField
      {...common}
      {...typeProps}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
    />
  );
}
