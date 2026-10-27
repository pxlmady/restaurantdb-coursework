// Перевірка підключення серверної частини до SQL Server через DATABASE_URL.
// Лише читає дані: назву бази, версію сервера і перелік таблиць.
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';

try {
  const [row] = await prisma.$queryRaw`SELECT DB_NAME() AS db, @@VERSION AS version`;
  const tables = await prisma.$queryRaw`
    SELECT TABLE_NAME AS name
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'sysdiagrams'
    ORDER BY TABLE_NAME`;
  console.log(`Підключення успішне. База даних: ${row.db}`);
  console.log(row.version.split('\n')[0].trim());
  console.log(`Таблиці (${tables.length}): ${tables.map((t) => t.name).join(', ')}`);
} catch (err) {
  console.error('Не вдалося підключитися до SQL Server:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
