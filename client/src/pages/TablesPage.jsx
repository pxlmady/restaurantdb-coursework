import CrudPage from '../components/CrudPage.jsx';

// Таблиця [Table]: номер столика — первинний ключ, задається вручну і не змінюється
const tables = {
  endpoint: '/tables',
  getId: (row) => row.table_number,
  names: {
    add: 'Додати столик',
    create: 'Новий столик',
    edit: (row) => `Столик №${row.table_number}`,
    deleteTitle: 'Видалити столик?',
    deleteText: (row) =>
      `Столик №${row.table_number} буде видалено. ` +
      'Видалення неможливе, якщо на столик є бронювання або замовлення.',
    saved: (row, edited) => `Столик №${row.table_number} ${edited ? 'змінено' : 'додано'}`,
    deleted: (row) => `Столик №${row.table_number} видалено`,
  },
  columns: [
    { field: 'table_number', label: 'Номер столика' },
    { field: 'capacity', label: 'Місткість, осіб', align: 'right' },
    { field: 'reservations_count', label: 'Бронювань', align: 'right' },
    { field: 'orders_count', label: 'Замовлень', align: 'right' },
  ],
  getSearchText: (row) => `${row.table_number}`,
  searchPlaceholder: 'Номер столика',
  initialSort: { field: 'table_number', direction: 'asc' },
  // Номер столика — змістовний ключ, що його вводить користувач, тому окремий «№» не потрібен
  numbered: false,
  fields: (_values, row) => [
    {
      name: 'table_number',
      label: 'Номер столика',
      type: 'number',
      required: true,
      autoFocus: !row,
      disabled: Boolean(row),
      helperText: row ? 'Номер є первинним ключем і не змінюється' : 'Ціле число, унікальне',
    },
    {
      name: 'capacity',
      label: 'Місткість, осіб',
      type: 'number',
      required: true,
      autoFocus: Boolean(row),
    },
  ],
  emptyValues: () => ({ table_number: '', capacity: '' }),
  toValues: (row) => ({ table_number: String(row.table_number), capacity: String(row.capacity) }),
};

export default function TablesPage() {
  return (
    <CrudPage
      title="Столики"
      description="Столики залу та їхня місткість. Кількість осіб у бронюванні не може перевищувати місткість."
      entity={tables}
    />
  );
}
