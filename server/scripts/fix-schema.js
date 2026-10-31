// Уточнення prisma/schema.prisma після `prisma db pull` (запускається скриптом npm run db:pull).
// Повторна інтроспекція зберігає назви зв'язків, коментарі /// і @@ignore, але
// повертає дві речі, які тут виправляються:
// 1) значення за замовчуванням для NVARCHAR Prisma читає разом із префіксом N і лапками:
//    @default("N'Активне'") замість @default("Активне"); з таким значенням вставка порушує CHECK;
// 2) загальний коментар на початку файлу.
import { readFile, writeFile } from 'node:fs/promises';

const SCHEMA = new URL('../prisma/schema.prisma', import.meta.url);

const HEADER = `// Схема бази даних RestaurantDB (Prisma ORM, Microsoft SQL Server).
// Моделі отримано з наявної бази командою \`npm run db:pull\` (prisma db pull + scripts/fix-schema.js).
// Назви моделей і полів збігаються з назвами таблиць і стовпців; назви зв'язків задано вручну.
// Не запускайте \`prisma migrate dev\` і \`prisma db push\`: вони можуть змінити або очистити базу.
`;

let schema = await readFile(SCHEMA, 'utf8');
let fixes = 0;

schema = schema.replace(/@default\("N'((?:[^'"]|'')*)'"/g, (_match, value) => {
  fixes += 1;
  return `@default("${value.replaceAll("''", "'")}"`;
});

if (!schema.startsWith(HEADER)) {
  schema = `${HEADER}\n${schema.replace(/^(\/\/.*\r?\n)*\r?\n?/, '')}`;
}

await writeFile(SCHEMA, schema);
console.log(`Схему уточнено: виправлено значень за замовчуванням — ${fixes}.`);
