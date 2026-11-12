import { useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { splitApiError } from '../api/client.js';
import { useApiData } from '../hooks/useApiData.js';
import DataTable from './DataTable.jsx';
import FormField from './FormField.jsx';
import SqlPanel from './SqlPanel.jsx';
import SummaryCards from './SummaryCards.jsx';

// Сторінка одного запиту етапу 8: фільтри → GET /api/queries/<endpoint>?… → підсумки, таблиця, SQL.
// Запит виконується під час відкриття сторінки і після натискання «Виконати запит».
//
// query: {
//   code: 'Q1', title, description,
//   prototype,                       звідки взято запит (ПР1, ЛР2 №…)
//   technique,                       як реалізовано: 'Prisma findMany', '$queryRaw' тощо
//   endpoint: 'order-details',
//   filters: [...] | (values) => [...],   поля FormField
//   initialValues: { ... } | () => { ... },   значення фільтрів за замовчуванням
//   columns | (data) => columns, getRowId, initialSort,   див. DataTable
//   summary(summary, data) => [{ label, value, hint }],   підсумкові картки
//   note(data) => вузол                   пояснення під підсумками (необов'язково)
// }
// lookups — довідники для списків у фільтрах (офіціанти, столики), передаються у filters.

const toSearch = (values) =>
  new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== '' && value !== null),
  ).toString();

const initial = (query) =>
  typeof query.initialValues === 'function' ? query.initialValues() : query.initialValues;

export default function QueryPage({ query, lookups }) {
  const [values, setValues] = useState(() => initial(query));
  const [applied, setApplied] = useState(values);
  const search = toSearch(applied);
  const { data, error, loading, reload } = useApiData(
    `/queries/${query.endpoint}${search ? `?${search}` : ''}`,
  );

  const filters =
    typeof query.filters === 'function' ? query.filters(values, lookups) : query.filters;
  const { fieldErrors, formError } = error
    ? splitApiError(
        error,
        filters.map((f) => f.name),
      )
    : { fieldErrors: {}, formError: null };
  const result = error ? null : data;

  const run = (event) => {
    event.preventDefault();
    if (toSearch(values) === search) reload();
    else setApplied(values);
  };
  const reset = () => {
    const start = initial(query);
    setValues(start);
    setApplied(start);
  };
  const change = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

  const columns = typeof query.columns === 'function' ? query.columns(result) : query.columns;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <Chip label={query.code} color="primary" size="small" />
        <Typography variant="h5" component="h1">
          {query.title}
        </Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {query.description}
      </Typography>
      <Stack direction="row" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Chip size="small" variant="outlined" label={`Прототип: ${query.prototype}`} />
        <Chip size="small" variant="outlined" label={`Реалізація: ${query.technique}`} />
      </Stack>

      <Paper variant="outlined" component="form" onSubmit={run} sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            columnGap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          }}
        >
          {filters.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name]}
              error={fieldErrors[field.name]}
              onChange={change}
            />
          ))}
        </Box>
        <Stack
          direction="row"
          sx={{ flexWrap: 'wrap', gap: 1, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}
        >
          <Button type="submit" variant="contained" startIcon={<PlayArrowIcon />}>
            Виконати запит
          </Button>
          <Button startIcon={<RestartAltIcon />} onClick={reset}>
            Скинути фільтри
          </Button>
        </Stack>
      </Paper>

      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}

      {result && <SummaryCards items={query.summary(result.summary, result)} />}
      {result && query.note?.(result)}

      <DataTable
        columns={columns}
        rows={result?.rows ?? (error ? [] : null)}
        getRowId={query.getRowId}
        loading={loading}
        initialSort={query.initialSort}
        emptyText="Запит не повернув жодного рядка"
      />

      <SqlPanel sql={result?.sql} />
    </Box>
  );
}
