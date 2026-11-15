// Допоміжні функції сторінок сайту ресторану

const pad = (n) => String(n).padStart(2, '0');

// rules — SITE_RULES із GET /api/site/info
export const hoursLabel = (rules) =>
  `Щодня з ${pad(rules.open_hour)}:00 до ${pad(rules.close_hour)}:00`;

// Час, на який можна забронювати столик: кожні пів години від відкриття до останнього бронювання
export function bookingTimes(rules) {
  const times = [];
  for (let minutes = rules.open_hour * 60; minutes <= rules.last_booking_hour * 60; minutes += 30) {
    times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return times;
}

// Сьогоднішня дата у форматі поля <input type="date"> (місцевий час)
export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Дата, яку форма бронювання пропонує спочатку: сьогодні, а якщо час time ("19:00")
// сьогодні вже минув — завтра
export function defaultDate(time) {
  const date = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  if (date.getHours() * 60 + date.getMinutes() >= hours * 60 + minutes) {
    date.setDate(date.getDate() + 1);
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "2" → "2 особи", "5" → "5 осіб"
export function peopleLabel(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} особа`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} особи`;
  return `${count} осіб`;
}

// Телефон: прибираємо пробіли, дужки й дефіси; повний номер — +380 і 9 цифр
export const normalizePhone = (value) => value.replace(/[\s()-]/g, '');
export const isPhone = (value) => /^\+380\d{9}$/.test(normalizePhone(value));
export const PHONE_HINT = 'Формат: +380XXXXXXXXX';

// Телефон останнього бронювання запам'ятовуємо у вкладці, щоб підставити в «Мої бронювання»
const PHONE_KEY = 'restaurant-site-phone';
export const savedPhone = () => sessionStorage.getItem(PHONE_KEY) ?? '';
export const savePhone = (value) => sessionStorage.setItem(PHONE_KEY, normalizePhone(value));
