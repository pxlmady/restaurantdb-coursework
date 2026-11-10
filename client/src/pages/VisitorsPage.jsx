import CrudPage from '../components/CrudPage.jsx';

// Таблиця Visitor: ПІБ і унікальний телефон
const visitors = {
  endpoint: '/visitors',
  getId: (row) => row.id_visitor,
  names: {
    add: 'Додати відвідувача',
    create: 'Новий відвідувач',
    edit: (row) => `Відвідувач №${row.id_visitor}`,
    deleteTitle: 'Видалити відвідувача?',
    deleteText: (row) =>
      `Відвідувача «${row.full_name}» (${row.phone_number}) буде видалено. ` +
      'Видалення неможливе, якщо у відвідувача є бронювання.',
    saved: (row, edited) => `Відвідувача «${row.full_name}» ${edited ? 'змінено' : 'додано'}`,
    deleted: (row) => `Відвідувача «${row.full_name}» видалено`,
  },
  columns: [
    { field: 'id_visitor', label: 'ID' },
    { field: 'full_name', label: 'ПІБ' },
    { field: 'phone_number', label: 'Телефон' },
    { field: 'reservations_count', label: 'Бронювань', align: 'right' },
  ],
  getSearchText: (row) => `${row.full_name} ${row.phone_number}`,
  searchPlaceholder: 'ПІБ або телефон',
  fields: [
    { name: 'full_name', label: 'ПІБ', required: true, autoFocus: true, maxLength: 100 },
    {
      name: 'phone_number',
      label: 'Телефон',
      required: true,
      maxLength: 20,
      helperText: 'У форматі +380XXXXXXXXX; не має повторювати телефон іншого відвідувача',
    },
  ],
  emptyValues: () => ({ full_name: '', phone_number: '' }),
  toValues: (row) => ({ full_name: row.full_name, phone_number: row.phone_number }),
};

export default function VisitorsPage() {
  return (
    <CrudPage
      title="Відвідувачі"
      description="Клієнти ресторану, які бронюють столики."
      entity={visitors}
    />
  );
}
