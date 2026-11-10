import CrudPage from '../components/CrudPage.jsx';
import { formatMoney } from '../lib/format.js';

// Таблиця Dish: назва унікальна, ціна DECIMAL(10,2) ≥ 0, вага > 0
const dishes = {
  endpoint: '/dishes',
  getId: (row) => row.id_dish,
  names: {
    add: 'Додати страву',
    create: 'Нова страва',
    edit: (row) => `Страва №${row.id_dish}`,
    deleteTitle: 'Видалити страву?',
    deleteText: (row) =>
      `Страву «${row.title}» буде видалено з меню. ` +
      'Видалення неможливе, якщо страва є в замовленнях.',
    saved: (row, edited) => `Страву «${row.title}» ${edited ? 'змінено' : 'додано'}`,
    deleted: (row) => `Страву «${row.title}» видалено`,
  },
  columns: [
    { field: 'id_dish', label: 'ID' },
    { field: 'title', label: 'Назва' },
    {
      field: 'price',
      label: 'Ціна',
      align: 'right',
      render: (row) => formatMoney(row.price),
      nowrap: true,
      sortValue: (row) => Number(row.price),
    },
    { field: 'weight_grams', label: 'Вага, г', align: 'right' },
    { field: 'order_details_count', label: 'У замовленнях', align: 'right' },
  ],
  getSearchText: (row) => row.title,
  searchPlaceholder: 'Назва страви',
  fields: [
    { name: 'title', label: 'Назва', required: true, autoFocus: true, maxLength: 100 },
    {
      name: 'price',
      label: 'Ціна, грн',
      type: 'money',
      required: true,
      helperText: 'Наприклад 140 або 140.50',
    },
    { name: 'weight_grams', label: 'Вага, г', type: 'number', required: true },
  ],
  emptyValues: () => ({ title: '', price: '', weight_grams: '' }),
  toValues: (row) => ({
    title: row.title,
    price: row.price,
    weight_grams: String(row.weight_grams),
  }),
  // Кома як десятковий роздільник теж приймається
  toBody: (values) => ({ ...values, price: values.price.replace(',', '.') }),
};

export default function DishesPage() {
  return <CrudPage title="Меню" description="Страви, їхні ціни та вага порції." entity={dishes} />;
}
