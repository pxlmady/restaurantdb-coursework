// Запити етапу 8 (аналітика й пошук). Лише читання: GET з параметрами фільтрів у рядку запиту.
// Кожна відповідь: { params, rows, summary, sql: [{ title, text, params? }] },
// де sql — текст запиту для показу на сторінці (захист курсової).
import { Router } from 'express';
import { orderDetails } from '../queries/q1-order-details.js';
import { visitorSpending } from '../queries/q2-visitor-spending.js';
import { noExpensiveDishes } from '../queries/q3-no-expensive-dishes.js';
import { withoutActivity } from '../queries/q4-without-activity.js';
import { dishStats } from '../queries/q5-dish-stats.js';
import { reservationSearch } from '../queries/q6-reservation-search.js';
import { waiterTotals } from '../queries/q7-waiter-totals.js';
import { freeTables } from '../queries/q8-free-tables.js';
import { showParams } from '../queries/common.js';

export const queriesRouter = Router();

const QUERIES = {
  'order-details': orderDetails, // Q1
  'visitor-spending': visitorSpending, // Q2
  'no-expensive-dishes': noExpensiveDishes, // Q3
  'without-activity': withoutActivity, // Q4
  'dish-stats': dishStats, // Q5
  'reservation-search': reservationSearch, // Q6
  'waiter-totals': waiterTotals, // Q7
  'free-tables': freeTables, // Q8
};

for (const [path, run] of Object.entries(QUERIES)) {
  queriesRouter.get(`/${path}`, async (req, res) => {
    const result = await run(req.query);
    // Дати параметрів повертаємо у вигляді "2026-11-08", як їх вводять у фільтрах
    res.json({ ...result, params: showParams(result.params) });
  });
}
