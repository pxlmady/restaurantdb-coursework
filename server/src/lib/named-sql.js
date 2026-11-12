// Параметризований SQL з іменованими параметрами у стилі T-SQL (@from, @status).
// Текст запиту лишається таким, яким його пишуть у SSMS, а значення параметрів
// передаються в базу окремо від тексту (Prisma $queryRaw), тому SQL-ін'єкція неможлива.
// Той самий текст клієнт показує на сторінці запиту (блок «SQL-запит»).
import { Prisma } from '@prisma/client';

const PARAM = /@([a-z_]+)/g;

// namedSql('... WHERE price >= @price', { price: 200 }) → об'єкт для prisma.$queryRaw
export function namedSql(text, params) {
  const strings = [];
  const values = [];
  let last = 0;
  for (const match of text.matchAll(PARAM)) {
    const name = match[1];
    if (!(name in params)) throw new Error(`SQL-параметр @${name} не передано`);
    strings.push(text.slice(last, match.index));
    values.push(params[name]);
    last = match.index + match[0].length;
  }
  strings.push(text.slice(last));
  return Prisma.sql(strings, ...values);
}

// Виконує запит і повертає рядки результату
export const runSql = (prisma, text, params) => prisma.$queryRaw(namedSql(text, params));
