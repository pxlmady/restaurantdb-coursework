import { MenuItem, TextField } from '@mui/material';

// Відбір записів за статусом (значення з довідника /api/dictionaries)
export default function StatusFilter({ label = 'Статус', statuses, value, onChange }) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 180 }}
    >
      <MenuItem value="">Усі</MenuItem>
      {(statuses ?? []).map((status) => (
        <MenuItem key={status} value={status}>
          {status}
        </MenuItem>
      ))}
    </TextField>
  );
}
