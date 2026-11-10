// Відображення значень, які повертає API.

// "2026-11-08T19:00" → "08.11.2026 19:00" (рядок без часового поясу, як у DATETIME)
export function formatDateTime(value) {
  if (!value) return '—';
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year} ${time}`;
}

// "140.00" → "140.00 грн"
export const formatMoney = (value) =>
  value === null || value === undefined ? '—' : `${value} грн`;

// Поточна дата й найближча повна година у форматі поля datetime-local
export function nextHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:00`
  );
}

// Кольори статусів (обмеження CHECK у базі)
export const STATUS_COLORS = {
  Активне: 'primary',
  Завершене: 'success',
  Скасоване: 'default',
  Оплачено: 'success',
  'В очікуванні': 'warning',
  Скасовано: 'default',
};
