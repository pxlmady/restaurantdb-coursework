// Уточнення prisma/schema.prisma після `prisma db pull` (запускається скриптом npm run db:pull).
// Повторна інтроспекція зберігає назви зв'язків, коментарі /// і @@ignore, але
// повертає дві речі, які тут виправляються:
// 1) значення за замовчуванням для NVARCHAR Prisma читає разом із префіксом N і лапками:
//    @default("N'Активне'") замість @default("Активне"); з таким значенням вставка порушує CHECK;
// 2) загальний коментар на початку файлу;
// 3) (з етапу 5) зв'язок «бронювання — замовлення» один-до-одного. Унікальність id_reservation
//    у базі забезпечує фільтрований індекс UX_Order_Reservation (WHERE id_reservation IS NOT NULL),
//    а такі індекси Prisma не читає: без виправлення db pull прибирає @unique і робить
//    Reservation.order списком Order[]. Prisma ці атрибути лише читає, у базу нічого не пише.
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

// Додаємо @unique до id_reservation у моделі Order, якщо db pull його прибрав
schema = schema.replace(
  /^(model Order \{[\s\S]*?^\s*id_reservation\s+Int\?)([^\S\r\n]*)(?!.*@unique)(.*)$/m,
  (_m, field, _sp, rest) => {
    fixes += 1;
    return `${field} @unique(map: "UX_Order_Reservation")${rest ? ` ${rest}` : ''}`;
  },
);

// Повертаємо Reservation.order як одне необов'язкове замовлення (Order?) замість списку
schema = schema.replace(/^(model Reservation \{[\s\S]*?^\s*order\s+)Order\[\]/m, (_m, start) => {
  fixes += 1;
  return `${start}Order?`;
});

if (!schema.startsWith(HEADER)) {
  schema = `${HEADER}\n${schema.replace(/^(\/\/.*\r?\n)*\r?\n?/, '')}`;
}

await writeFile(SCHEMA, schema);
console.log(`Схему уточнено, виправлень: ${fixes}.`);
