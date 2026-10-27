# RestaurantDB — курсова робота

Навчальний вебзастосунок для бази даних ресторану RestaurantDB (дисципліна «Технології проектування
та адміністрування баз даних та сховищ даних»).

Стек: React + Vite + Material UI (клієнт), Node.js + Express (сервер), Microsoft SQL Server 2025 у
Docker + Prisma ORM (дані). Запуск лише локальний.

Поточний стан: **етап 3 — каркас застосунку**. Клієнт показує стан сервера й бази даних; моделі Prisma,
CRUD і запити додаються на наступних етапах.

## Структура

```
client/                клієнтська частина (React, Vite, MUI)
server/                серверна частина (Express, Prisma)
  prisma/              схема бази даних Prisma
  scripts/             службові скрипти (перевірка підключення до БД)
  src/                 код API
database/
  backup/              бекап RestaurantDB.bak (у git не потрапляє)
  scripts/
    restore.sql        відновлення RestaurantDB з бекапу, лише якщо бази ще немає
    check_structure.sql знімок структури бази (лише читання)
  reports/             результати перевірок (у git не потрапляють)
docs/                  даталогічна модель (draw.io і PNG)
docker-compose.yml     контейнер SQL Server + одноразове відновлення бази
.env.example           змінні для контейнера (пароль sa, порт)
server/.env.example    змінні серверної частини (DATABASE_URL, PORT)
```

## Вимоги

- Node.js LTS 22.12+ (або 24);
- Docker Desktop (бекенд WSL 2), запущений; SQL Server потребує щонайменше 2 ГБ пам'яті;
- PyCharm Professional з плагінами Docker і Database Tools (або SSMS для перегляду бази).

## Перший запуск бази

1. Скопіюйте `.env.example` → `.env` і задайте пароль `MSSQL_SA_PASSWORD`.
2. Покладіть бекап у `database/backup/RestaurantDB.bak`.
3. Запустіть контейнери: відкрийте `docker-compose.yml` у PyCharm і натисніть ▶ біля `services:`
   (або вікно **Services** → Docker → Docker Compose), чи в терміналі в корені проєкту:
   `docker compose up -d`.
4. Під час першого запуску Docker завантажить образ SQL Server (близько 2,4 ГБ). Сервер стартує
   20–60 секунд, після цього сервіс `db-init` відновлює базу й записує
   `database/reports/check_structure.txt`.
5. Перевірка: `docker compose ps -a` — `restaurantdb-mssql` у стані `healthy`, `restaurantdb-mssql-init` —
   `Exited (0)`; `docker compose logs db-init` закінчується рядком про знімок структури.

## Перший запуск застосунку

Виконується після того, як база запущена (див. попередній розділ). Команди вводяться в терміналі PyCharm
у корені проєкту.

1. Скопіюйте `server/.env.example` → `server/.env` і в `DATABASE_URL` замініть `PASSWORD` на пароль
   `MSSQL_SA_PASSWORD` з кореневого `.env`. Якщо змінювали `MSSQL_PORT`, замініть і порт `1433`.
2. Установіть залежності: `npm run install:all`. Після встановлення серверних пакетів Prisma сама
   виконає `prisma generate`.
3. Перевірте підключення сервера до бази: `npm run db:check`. Очікувано: назва бази `RestaurantDB`,
   версія SQL Server і 7 таблиць.
4. Запустіть сервер: `npm run dev:server` → http://localhost:3000/api/health
5. В іншій вкладці терміналу запустіть клієнт: `npm run dev:client` → http://localhost:5173

## Перевірки працездатності

| Адреса                | Очікувана відповідь                                                    |
| --------------------- | ---------------------------------------------------------------------- |
| `GET /api/health`     | `{"status":"ok", ...}`                                                 |
| `GET /api/health/db`  | `{"status":"ok","database":"connected","name":"RestaurantDB"}` або 503 |
| http://localhost:5173 | сторінка зі станом клієнта, сервера та бази даних                      |

Схема Prisma поки не містить моделей: їх буде отримано з наявної бази командою `prisma db pull`.
Команди `prisma migrate dev` і `prisma db push` для цієї бази не використовуються, бо можуть змінити
або очистити її.

## Підключення до бази з IDE

| Параметр       | Значення                                              |
| -------------- | ----------------------------------------------------- |
| Сервер         | `localhost`, порт `1433` (`MSSQL_PORT`)               |
| Автентифікація | SQL Server, користувач `sa`, пароль з `.env`          |
| База даних     | `RestaurantDB`                                        |
| Сертифікат     | довіряти сертифікату сервера (trustServerCertificate) |

- **PyCharm** (Database Tools): **+** → **Data Source** → **Microsoft SQL Server**; Host `localhost`,
  Port `1433`, Authentication `User & Password`, User `sa`, Database `RestaurantDB`; на вкладці
  **Advanced** встановіть `trustServerCertificate` = `true`.
- **SSMS**: Server name `localhost,1433` (порт через кому), Authentication `SQL Server Authentication`,
  Login `sa`, позначка **Trust server certificate**.

Локальний екземпляр `SQLEXPRESS` при цьому не змінюється й працює окремо.

## Повторні запуски і дані

- Під час кожного `up` сервіс `db-init` перевіряє, чи є база. Якщо є, нічого не відновлює, лише
  оновлює звіт.
- Дані зберігаються в томі Docker `restaurantdb-coursework_restaurantdb-mssql-data` і не зникають після
  `docker compose down` чи перезавантаження комп'ютера.
- `docker compose down -v` **видаляє том разом з усіма змінами в базі**. Не використовуйте без потреби.
- `MSSQL_SA_PASSWORD` застосовується лише під час першого створення тому. Якщо змінити пароль у `.env`
  пізніше, у базі лишиться старий.

## Якщо щось пішло не так

| Ознака                                               | Що зробити                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `port is already allocated` для 1433                 | у `.env` задайте `MSSQL_PORT=1434` і підключайтесь до `localhost:1434` (`localhost,1434` в SSMS)                           |
| `restaurantdb-mssql` зупиняється одразу після старту | `docker compose logs db`; найчастіше пароль не відповідає вимогам складності                                               |
| `db-init`: `Cannot open backup device`               | немає файлу `database/backup/RestaurantDB.bak`                                                                             |
| `db-init`: не вдалося записати звіт                  | виконайте `database/scripts/check_structure.sql` у PyCharm або SSMS                                                        |
| `db:check`: `Authentication failed`                  | пароль у `server/.env` не збігається з `MSSQL_SA_PASSWORD` у кореневому `.env`                                             |
| `db:check`: `Can't reach database server`            | контейнер `restaurantdb-mssql` не запущений або порт у `DATABASE_URL` інший                                                |
| `EADDRINUSE` для 3000 або 5173                       | порт зайнятий іншою програмою; для сервера задайте інший `PORT` у `server/.env` і той самий порт у `client/vite.config.js` |

## Якість коду

- `npm run lint` — ESLint для сервера й клієнта;
- `npm run format` / `npm run format:check` — Prettier для всього проєкту.

Файли `.env` до репозиторію не додаються (див. `.gitignore`).
