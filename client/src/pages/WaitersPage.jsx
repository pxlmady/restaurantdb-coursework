import CrudPage from '../components/CrudPage.jsx';

// Таблиця Waiter
const waiters = {
  endpoint: '/waiters',
  getId: (row) => row.id_waiter,
  names: {
    add: 'Додати офіціанта',
    create: 'Новий офіціант',
    edit: (row) => `Офіціант №${row.id_waiter}`,
    deleteTitle: 'Видалити офіціанта?',
    deleteText: (row) =>
      `Офіціанта «${row.full_name}» буде видалено. ` +
      'Видалення неможливе, якщо офіціант обслуговував замовлення.',
    saved: (row, edited) => `Офіціанта «${row.full_name}» ${edited ? 'змінено' : 'додано'}`,
    deleted: (row) => `Офіціанта «${row.full_name}» видалено`,
  },
  columns: [
    { field: 'id_waiter', label: 'ID' },
    { field: 'full_name', label: 'ПІБ' },
    { field: 'orders_count', label: 'Замовлень', align: 'right' },
  ],
  getSearchText: (row) => row.full_name,
  searchPlaceholder: 'ПІБ',
  fields: [{ name: 'full_name', label: 'ПІБ', required: true, autoFocus: true, maxLength: 100 }],
  emptyValues: () => ({ full_name: '' }),
  toValues: (row) => ({ full_name: row.full_name }),
};

export default function WaitersPage() {
  return (
    <CrudPage
      title="Офіціанти"
      description="Працівники, які обслуговують замовлення."
      entity={waiters}
    />
  );
}
