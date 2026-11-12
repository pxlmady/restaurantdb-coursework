// Спільне для запитів етапу 8: параметри фільтрів і перетворення результатів у JSON.
import { Prisma } from '@prisma/client';
import { PAYMENT_STATUSES } from '../domain/dictionaries.js';
import { invalidField } from '../lib/http-error.js';
import { formatMoney } from '../lib/format.js';
import { oneOf } from '../lib/validation.js';

export const MAX_INT = 2147483647;

// Необов'язковий фільтр за статусом оплати (CHK_Order_Status)
export const paymentStatus = oneOf({ required: false, values: PAYMENT_STATUSES });

// Кінець періоду включно: «до 08.11» означає date_time < 09.11 00:00
export const nextDay = (date) => date && new Date(date.getTime() + 24 * 60 * 60 * 1000);

export const checkPeriod = (from, to) => {
  if (from && to && from > to) {
    throw invalidField('to', 'Кінець періоду має бути не раніше за початок');
  }
};

// SUM/AVG по DECIMAL повертаються як Prisma.Decimal, COUNT — як число; NULL → 0
export const decimal = (value) => new Prisma.Decimal(value ?? 0);
export const money = (value) => formatMoney(decimal(value));
export const sumBy = (rows, pick) =>
  rows.reduce((sum, row) => sum.add(decimal(pick(row))), decimal(0));

// Значення параметрів для показу під текстом SQL: дата як "2026-11-08" або "2026-11-08 19:00"
const showValue = (value) => {
  if (!(value instanceof Date)) return value;
  const [day, time] = value.toISOString().slice(0, 16).split('T');
  return time === '00:00' ? day : `${day} ${time}`;
};

export const showParams = (params) =>
  Object.fromEntries(Object.entries(params).map(([name, value]) => [name, showValue(value)]));
