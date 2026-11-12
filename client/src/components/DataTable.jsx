import { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import ExpandLessIcon from '@mui/icons-material/KeyboardArrowUp';
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';

const collator = new Intl.Collator('uk', { numeric: true, sensitivity: 'base' });

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

// Таблиця записів з пошуком, сортуванням за стовпцями і кнопками «Редагувати» / «Видалити».
// columns: [{ field, label, align, render(row), sortValue(row), sortable, nowrap }]
// renderDetail(row) — вміст рядка, що розгортається (наприклад, позиції замовлення).
// Без onEdit і onDelete стовпця «Дії» немає (таблиці результатів запитів).
// numbered — стовпець «№» з порядковим номером рядка 1, 2, 3… у поточному сортуванні.
// Ідентифікатор з бази (IDENTITY) показується окремим стовпцем «ID»: у SQL Server він може мати
// пропуски (кеш IDENTITY, видалені записи, відкочені транзакції), тому для підрахунку не годиться.
export default function DataTable({
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  getSearchText,
  searchPlaceholder = 'Пошук',
  toolbar,
  addLabel = 'Додати',
  onAdd,
  onEdit,
  onDelete,
  renderDetail,
  initialSort = null,
  numbered = true,
  emptyText = 'Записів немає',
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort); // { field, direction }
  const [expanded, setExpanded] = useState(null);

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let result = rows ?? [];
    if (words.length > 0 && getSearchText) {
      result = result.filter((row) => {
        const text = getSearchText(row).toLowerCase();
        return words.every((word) => text.includes(word));
      });
    }
    if (sort) {
      const column = columns.find((c) => c.field === sort.field);
      const value = column.sortValue ?? ((row) => row[column.field]);
      const sign = sort.direction === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => sign * compare(value(a), value(b)));
    }
    return result;
  }, [rows, query, sort, columns, getSearchText]);

  const toggleSort = (field) => {
    setSort((prev) =>
      prev?.field === field && prev.direction === 'asc'
        ? { field, direction: 'desc' }
        : { field, direction: 'asc' },
    );
  };

  const hasActions = Boolean(onEdit || onDelete);
  const columnCount =
    columns.length + (hasActions ? 1 : 0) + (renderDetail ? 1 : 0) + (numbered ? 1 : 0);
  const total = rows?.length ?? 0;

  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ p: 2, alignItems: { sm: 'center' } }}
      >
        {getSearchText && (
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: 260 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
        {toolbar}
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {visible.length === total ? `Записів: ${total}` : `Знайдено ${visible.length} з ${total}`}
        </Typography>
        {onAdd && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mx: 2, mb: 2 }}
          action={
            onRetry && (
              <Button color="inherit" size="small" onClick={onRetry}>
                Повторити
              </Button>
            )
          }
        >
          Не вдалося завантажити дані: {error.message}
        </Alert>
      )}
      {loading && <LinearProgress />}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {renderDetail && <TableCell padding="checkbox" />}
              {numbered && <TableCell sx={{ fontWeight: 600, width: 56 }}>№</TableCell>}
              {columns.map((column) => (
                <TableCell key={column.field} align={column.align} sx={{ fontWeight: 600 }}>
                  {column.sortable === false ? (
                    column.label
                  ) : (
                    <TableSortLabel
                      active={sort?.field === column.field}
                      direction={sort?.field === column.field ? sort.direction : 'asc'}
                      onClick={() => toggleSort(column.field)}
                    >
                      {column.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell align="right" sx={{ fontWeight: 600, width: 100 }}>
                  Дії
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row, index) => {
              const id = getRowId(row);
              const isOpen = expanded === id;
              return (
                <Fragment key={id}>
                  <TableRow hover sx={renderDetail ? { '& > td': { borderBottom: 'unset' } } : {}}>
                    {renderDetail && (
                      <TableCell padding="checkbox">
                        <IconButton
                          size="small"
                          aria-label={isOpen ? 'Згорнути' : 'Розгорнути'}
                          onClick={() => setExpanded(isOpen ? null : id)}
                        >
                          {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                    )}
                    {numbered && (
                      <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={column.field}
                        align={column.align}
                        sx={column.nowrap ? { whiteSpace: 'nowrap' } : undefined}
                      >
                        {column.render ? column.render(row) : row[column.field]}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {onEdit && (
                          <Tooltip title="Редагувати">
                            <IconButton size="small" onClick={() => onEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onDelete && (
                          <Tooltip title="Видалити">
                            <IconButton size="small" color="error" onClick={() => onDelete(row)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  {renderDetail && (
                    <TableRow>
                      <TableCell colSpan={columnCount} sx={{ py: 0 }}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2 }}>{renderDetail(row)}</Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {total === 0 ? emptyText : 'Нічого не знайдено'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
