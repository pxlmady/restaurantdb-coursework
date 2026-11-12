// Прості правила перевірки тіла запиту. Кожне правило повертає перевірене значення
// або кидає ValidationIssue; validate() збирає всі помилки полів в одну відповідь 400.
import { HttpError } from './http-error.js';

class ValidationIssue extends Error {}

const isEmpty = (value) => value === undefined || value === null || value === '';

// Обгортка: обов'язковість і значення за замовчуванням для будь-якого правила
const rule =
  (check) =>
  ({ required = true, defaultValue, ...options } = {}) =>
  (value) => {
    if (isEmpty(value)) {
      if (defaultValue !== undefined) return defaultValue;
      if (required) throw new ValidationIssue("Поле обов'язкове");
      return null;
    }
    return check(value, options);
  };

export const text = rule((value, { max, pattern, patternMessage }) => {
  if (typeof value !== 'string') throw new ValidationIssue('Очікується рядок');
  const trimmed = value.trim();
  if (trimmed === '') throw new ValidationIssue("Поле обов'язкове");
  if (max && trimmed.length > max) throw new ValidationIssue(`Не більше ${max} символів`);
  if (pattern && !pattern.test(trimmed)) throw new ValidationIssue(patternMessage);
  return trimmed;
});

export const integer = rule((value, { min, max }) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(number)) throw new ValidationIssue('Очікується ціле число');
  if (min !== undefined && number < min)
    throw new ValidationIssue(`Значення має бути не менше ${min}`);
  if (max !== undefined && number > max)
    throw new ValidationIssue(`Значення має бути не більше ${max}`);
  return number;
});

// DECIMAL(10,2): до 8 цифр до коми і до 2 після. Повертає рядок для Prisma.
export const money = rule((value, { min = 0 }) => {
  const raw = typeof value === 'number' ? String(value) : value;
  if (typeof raw !== 'string' || !/^-?\d{1,8}(\.\d{1,2})?$/.test(raw.trim())) {
    throw new ValidationIssue(
      'Очікується сума, наприклад 140 або 140.50 (до 2 знаків після крапки)',
    );
  }
  if (Number(raw) < min) throw new ValidationIssue(`Значення має бути не менше ${min}`);
  return raw.trim();
});

export const oneOf = rule((value, { values }) => {
  if (!values.includes(value)) {
    throw new ValidationIssue(`Допустимі значення: ${values.join(', ')}`);
  }
  return value;
});

// Дата й час без часового поясу: "2026-11-08T19:00" (секунди необов'язкові).
// Зберігаємо ті самі години й хвилини, тому будуємо дату як UTC (див. lib/format.js).
export const dateTime = rule((value) => {
  const match =
    typeof value === 'string' &&
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new ValidationIssue('Очікується дата й час у форматі РРРР-ММ-ДДTГГ:ХХ');
  const [, y, mo, d, h, mi, s = '0'] = match.map((part) => part && Number(part));
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    h < 24 &&
    mi < 60 &&
    s < 60;
  // Тип DATETIME у SQL Server підтримує роки від 1753
  if (!valid || y < 1753 || y > 9999) throw new ValidationIssue('Такої дати не існує');
  return date;
});

// Дата без часу: "2026-11-08". Як і dateTime, будуємо її як UTC (див. lib/format.js).
export const date = rule((value) => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new ValidationIssue('Очікується дата у форматі РРРР-ММ-ДД');
  const [, y, mo, d] = match.map(Number);
  const result = new Date(Date.UTC(y, mo - 1, d));
  if (result.getUTCMonth() !== mo - 1 || result.getUTCDate() !== d || y < 1753 || y > 9998) {
    throw new ValidationIssue('Такої дати не існує');
  }
  return result;
});

// Перевіряє поля body за схемою { поле: правило } і повертає об'єкт лише з цими полями
export const validate = (body, schema) => {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Тіло запиту має бути JSON-об’єктом');
  }
  const result = {};
  const details = [];
  for (const [field, check] of Object.entries(schema)) {
    try {
      result[field] = check(body[field]);
    } catch (err) {
      if (!(err instanceof ValidationIssue)) throw err;
      details.push({ field, message: err.message });
    }
  }
  if (details.length > 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Перевірте введені дані', details);
  }
  return result;
};

// Ідентифікатор з адреси (/api/visitors/5)
export const parseId = (value, name = 'id') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Некоректний ідентифікатор: ${value}`, [
      { field: name, message: 'Очікується ціле додатне число' },
    ]);
  }
  return id;
};
