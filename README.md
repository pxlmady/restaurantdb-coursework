# RestaurantDB — курсова робота

Навчальний вебзастосунок для бази даних ресторану RestaurantDB (дисципліна «Технології проектування
та адміністрування баз даних та сховищ даних»).

Стек: React + Vite + Material UI (клієнт), Node.js + Express (сервер), Microsoft SQL Server 2025 у
Docker + Prisma ORM (дані). Запуск лише локальний.

Поточний стан: **етап 6 — CRUD API для 7 таблиць**. Застосунок працює з базою `RestaurantDB_KR`; сервер
надає CRUD для всіх таблиць (див. [CRUD API](#crud-api)), клієнт поки показує лише стан сервера й бази
даних. Інтерфейс CRUD і сторінки запитів додаються на наступних етапах.

## Структура

```
client/                клієнтська частина (React, Vite, MUI)
server/                серверна частина (Express, Prisma)
  prisma/              схема бази даних Prisma
  scripts/             службові скрипти (перевірка БД, тестове читання, уточнення схеми, перевірка API)
  src/
    routes/            маршрути API: по файлу на сутність
    lib/               Prisma Client, перевірка введення, переклад помилок бази, форматування
    middleware/        обробник помилок
    domain/            допустимі статуси (обмеження CHECK)
  api.http             приклади запитів для HTTP Client у PyCharm
database/
  backup/              бекап RestaurantDB.bak (у git не потрапляє)
  scripts/
    restore.sql        відновлення RestaurantDB з бекапу, лише якщо бази ще немає
    check_structure.sql знімок структури бази (лише читання)
    stage5/            база курсової RestaurantDB_KR: створення, бекап, виправлення, демо-дані
  reports/             результати перевірок (у git не потрапляють)
docs/                  даталогічна модель (draw.io і PNG)
docker-compose.yml     контейнер SQL Server, одноразове відновлення бази, інструмент sqlcmd
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

## База курсової RestaurantDB_KR

У контейнері дві бази з одного бекапу:

| База              | Хто користується                         | Чи змінюється курсовою                |
| ----------------- | ---------------------------------------- | ------------------------------------- |
| `RestaurantDB`    | практичні 3.1(5) і 3.2(6), інші програми | ні, лишається як у бекапі             |
| `RestaurantDB_KR` | цей застосунок (`DATABASE_URL`)          | так: виправлення структури, демо-дані |

Створення й підготовка `RestaurantDB_KR` (один раз, після запуску контейнерів; у Git Bash або терміналі
PyCharm у корені проєкту):

```bash
docker compose run --rm --no-deps sqlcmd stage5/01_create_coursework_db.sql stage5/02_backup_coursework_db.sql stage5/03_fix_structure.sql stage5/04_demo_data.sql
```

| Скрипт                        | Що робить                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `01_create_coursework_db.sql` | відновлює `RestaurantDB.bak` під назвою `RestaurantDB_KR` з окремими файлами; якщо база є, пропускає |
| `02_backup_coursework_db.sql` | повний бекап `RestaurantDB_KR` у `/var/opt/mssql/backup/` у контейнері з перевіркою `VERIFYONLY`     |
| `03_fix_structure.sql`        | замінює `UQ_Order_Reservation` фільтрованим індексом `UX_Order_Reservation`, вимикає `AUTO_CLOSE`    |
| `04_demo_data.sql`            | лише додає демо-дані для CRUD і запитів; повторний запуск нічого не дублює                           |

Усі скрипти можна запускати повторно. Сервіс `sqlcmd` (профіль `tools`) запускається лише командою
`docker compose run` і виконує файли з `database/scripts` по черзі, зупиняючись на першій помилці.

**Чому фільтрований індекс.** Обмеження `UNIQUE` на стовпці, що допускає `NULL`, у SQL Server дозволяє
лише один `NULL`, тобто лише одне замовлення без бронювання. Індекс
`UNIQUE ... WHERE id_reservation IS NOT NULL` так само не дає зробити два замовлення до одного
бронювання, але замовлень без бронювання може бути скільки завгодно. Фільтрований індекс вимагає
`SET QUOTED_IDENTIFIER ON` під час зміни даних таблиці `[Order]`: PyCharm, SSMS, JDBC і Prisma вмикають
його самі, у `sqlcmd` потрібен ключ `-I` (сервіс `sqlcmd` його передає).

Бекап перед будь-якою наступною зміною структури:
`docker compose run --rm --no-deps sqlcmd stage5/02_backup_coursework_db.sql`. Скопіювати бекап на диск:
`docker cp restaurantdb-mssql:/var/opt/mssql/backup/<файл>.bak database/backup/`.

## Перший запуск застосунку

Виконується після того, як база запущена (див. попередній розділ). Команди вводяться в терміналі PyCharm
у корені проєкту.

1. Скопіюйте `server/.env.example` → `server/.env` і в `DATABASE_URL` замініть `PASSWORD` на пароль
   `MSSQL_SA_PASSWORD` з кореневого `.env`. Якщо змінювали `MSSQL_PORT`, замініть і порт `1433`.
2. Установіть залежності: `npm run install:all`. Після встановлення серверних пакетів Prisma сама
   виконає `prisma generate`.
3. Перевірте підключення сервера до бази: `npm run db:check`. Очікувано: назва бази `RestaurantDB_KR`,
   версія SQL Server і 7 таблиць.
4. Перевірте читання через моделі Prisma: `npm run db:sample`. Очікувано: кількість записів у кожній
   таблиці і перше замовлення з позиціями.
5. Запустіть сервер: `npm run dev:server` → http://localhost:3000/api/health
6. В іншій вкладці терміналу запустіть клієнт: `npm run dev:client` → http://localhost:5173

## Перевірки працездатності

| Адреса                | Очікувана відповідь                                                       |
| --------------------- | ------------------------------------------------------------------------- |
| `GET /api/health`     | `{"status":"ok", ...}`                                                    |
| `GET /api/health/db`  | `{"status":"ok","database":"connected","name":"RestaurantDB_KR"}` або 503 |
| http://localhost:5173 | сторінка зі станом клієнта, сервера та бази даних                         |

Перевірка CRUD API: див. розділ [CRUD API](#crud-api), `npm run api:check`.

## CRUD API

Сервер (`npm run dev:server`, http://localhost:3000) надає повний CRUD для всіх 7 таблиць через Prisma ORM.
Усі відповіді у JSON. Клієнт Vite перенаправляє `/api` на сервер.

| Ресурс             | Таблиця       | Маршрути                                                                         |
| ------------------ | ------------- | -------------------------------------------------------------------------------- |
| Відвідувачі        | `Visitor`     | `GET/POST /api/visitors`, `GET/PUT/DELETE /api/visitors/:id`                     |
| Столики            | `[Table]`     | `GET/POST /api/tables`, `GET/PUT/DELETE /api/tables/:number`                     |
| Офіціанти          | `Waiter`      | `GET/POST /api/waiters`, `GET/PUT/DELETE /api/waiters/:id`                       |
| Страви             | `Dish`        | `GET/POST /api/dishes`, `GET/PUT/DELETE /api/dishes/:id`                         |
| Бронювання         | `Reservation` | `GET/POST /api/reservations`, `GET/PUT/DELETE /api/reservations/:id`             |
| Замовлення         | `[Order]`     | `GET/POST /api/orders`, `GET/PUT/DELETE /api/orders/:id`                         |
| Позиції замовлення | `OrderDetail` | `GET/POST /api/orders/:id/details`, `PUT/DELETE /api/orders/:id/details/:dishId` |
| Довідник статусів  | —             | `GET /api/dictionaries`                                                          |

Коди відповідей: `200` — успіх, `201` — створено, `204` — видалено, `400` — помилка введення,
`404` — запис не знайдено, `409` — конфлікт з даними (дубль або пов'язані записи). Помилки мають вигляд
`{ "error": { "code", "message", "details": [{ "field", "message" }] } }`, де `details` вказує поле форми.

Правила, які перевіряє сервер:

| Сутність   | Правила                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Відвідувач | ім'я до 100 символів; телефон до 20 символів і унікальний; видалення заборонене, якщо є бронювання                                                                                             |
| Столик     | номер задається під час створення і не змінюється; місткість > 0; видалення заборонене, якщо є бронювання чи замовлення                                                                        |
| Офіціант   | ім'я до 100 символів; видалення заборонене, якщо є замовлення                                                                                                                                  |
| Страва     | назва унікальна; ціна ≥ 0 (до 2 знаків після крапки); вага > 0; видалення заборонене, якщо страва є в замовленнях                                                                              |
| Бронювання | відвідувач і столик мають існувати; статус з 3 значень (за замовчуванням «Активне»); **кількість осіб не більша за місткість столика**; не можна змінити столик чи видалити, якщо є замовлення |
| Замовлення | бронювання необов'язкове, одне бронювання — одне замовлення; **з бронюванням столик береться з нього**; статус оплати з 3 значень; чайові ≥ 0 (за замовчуванням 0)                             |
| Позиція    | кількість > 0; страва в замовленні лише один раз (ключ `id_order` + `id_dish`); видаляються разом із замовленням (`ON DELETE CASCADE`)                                                         |

Жирним позначено правила курсової, яких немає в обмеженнях бази. Решта повторює обмеження `CHECK`,
`UNIQUE` і `FOREIGN KEY`: сервер перевіряє їх заздалегідь, щоб дати зрозуміле повідомлення, а якщо
порушення все ж дійде до бази, перекладає помилку SQL Server за назвою обмеження
(`server/src/lib/prisma-errors.js`). Prisma повертає порушення `CHECK` з кодом P2003 і текстом про
зовнішній ключ, тому без такого перекладу повідомлення було б оманливим.

**Транзакції.** Замовлення разом з позиціями (`POST /api/orders` з масивом `details`) створюється в одній
транзакції Prisma (`prisma.$transaction`). Спершу вставляється замовлення, потім перевіряються страви і
вставляються позиції. Якщо хоч одна страва не існує, транзакція відкочується, і замовлення теж не
зберігається. Так само `PUT /api/orders/:id` з `details` змінює шапку і повністю замінює позиції за один
раз. Після відкату лічильник `IDENTITY` у SQL Server не повертається, тому в номерах замовлень можуть бути
пропуски: це звичайна поведінка SQL Server.

**Формати.** Гроші (`price`, `tips`, `total`, `line_total`) — рядки з двома знаками (`"140.00"`), щоб не
втрачати точність `DECIMAL`. Дата й час бронювання — `"2026-11-08T19:00"`, без часового поясу, так само як
зберігається в `DATETIME`. Сума замовлення не зберігається в базі: сервер рахує її за поточними цінами страв.

**Перевірка.** При запущеному сервері виконайте в іншій вкладці терміналу `npm run api:check`. Скрипт
проходить сценарій CRUD для всіх сутностей (зокрема помилки введення, заборонені видалення, відкат
транзакції), а наприкінці видаляє записи, які створив, і звіряє кількість записів до й після. Окремі запити
вручну зручно надсилати з `server/api.http` (PyCharm → HTTP Client, ▶ біля запиту).

## Схема Prisma

`server/prisma/schema.prisma` отримано з бази (`prisma db pull`), а не написано вручну.

- 7 моделей відповідають таблицям, назви полів збігаються з назвами стовпців (`id_visitor`, `full_name`
  тощо), тому ті самі назви використовуються в SQL-запитах і в коді.
- Назви зв'язків задано вручну: `Visitor.reservations`, `Reservation.visitor`, `Reservation.order`,
  `Order.reservation`, `Order.waiter`, `Order.table`, `Order.order_details`, `OrderDetail.dish` тощо.
- Обмеження CHECK Prisma не відображає. Допустимі значення записано в коментарях `///` біля полів.
  Порушення CHECK Prisma повертає з кодом P2003 і назвою обмеження (наприклад, `CHK_Order_Status`).
- Службова таблиця SSMS `sysdiagrams` позначена `@@ignore`: у клієнті Prisma її немає.
- Значення за замовчуванням для `reservation_status` виправлено на `"Активне"`: `db pull` читає його як
  `"N'Активне'"`, і таке значення порушує CHECK під час вставки.
- `Order.id_reservation` позначено `@unique(map: "UX_Order_Reservation")`, а `Reservation.order` —
  `Order?` (одне бронювання — не більше одного замовлення). Фільтровані індекси Prisma не читає, тому
  без цього `db pull` зробив би `Reservation.order` списком. Обидва виправлення робить `fix-schema.js`.

## Зміни структури бази

Структуру змінюємо SQL-скриптами, а схему Prisma після цього оновлюємо з бази:

1. Перед зміною зробіть бекап бази: `docker compose run --rm --no-deps sqlcmd stage5/02_backup_coursework_db.sql`.
2. Напишіть SQL-скрипт у `database/scripts/` і виконайте його в PyCharm (Database Tools) або
   `docker compose run --rm --no-deps sqlcmd <шлях від database/scripts>`. Змінюйте лише `RestaurantDB_KR`.
3. Зупиніть сервер (`npm run dev:server`), щоб Windows не блокувала файли Prisma.
4. Виконайте `npm run db:pull`. Він запускає `prisma db pull`, скрипт `server/scripts/fix-schema.js`,
   який повертає виправлення, що їх `db pull` скидає, `prisma format` і `prisma generate`.
5. Перегляньте зміни `schema.prisma` у PyCharm (Git → Commit) і закомітьте скрипт разом зі схемою.

Повторний `db pull` зберігає назви зв'язків, коментарі `///` і `@@ignore`. Не запускайте
`npx prisma db pull` окремо: без `fix-schema.js` схема знову отримає хибне значення за замовчуванням.
`prisma migrate dev` і `prisma db push` не використовуються взагалі, бо можуть змінити або очистити базу.

## Підключення до бази з IDE

| Параметр       | Значення                                                |
| -------------- | ------------------------------------------------------- |
| Сервер         | `localhost`, порт `1433` (`MSSQL_PORT`)                 |
| Автентифікація | SQL Server, користувач `sa`, пароль з `.env`            |
| База даних     | `RestaurantDB_KR` (курсова), `RestaurantDB` (практичні) |
| Сертифікат     | довіряти сертифікату сервера (trustServerCertificate)   |

- **PyCharm** (Database Tools): **+** → **Data Source** → **Microsoft SQL Server**; Host `localhost`,
  Port `1433`, Authentication `User & Password`, User `sa`, Database `RestaurantDB_KR`; на вкладці
  **Advanced** встановіть `trustServerCertificate` = `true`.
- **SSMS**: Server name `localhost,1433` (порт через кому), Authentication `SQL Server Authentication`,
  Login `sa`, позначка **Trust server certificate**.

Локальний екземпляр `SQLEXPRESS` при цьому не змінюється й працює окремо.

## Повторні запуски і дані

- Під час кожного `up` сервіс `db-init` перевіряє, чи є база `RestaurantDB`. Якщо є, нічого не
  відновлює, лише оновлює звіт. `RestaurantDB_KR` він не створює й не змінює (див. розділ про неї).
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
| `EPERM` під час `prisma generate` або `db:pull`      | зупиніть сервер (`dev:server`) і повторіть команду                                                                         |
| `EADDRINUSE` для 3000 або 5173                       | порт зайнятий іншою програмою; для сервера задайте інший `PORT` у `server/.env` і той самий порт у `client/vite.config.js` |

## Якість коду

- `npm run lint` — ESLint для сервера й клієнта;
- `npm run format` / `npm run format:check` — Prettier для всього проєкту.

Файли `.env` до репозиторію не додаються (див. `.gitignore`).
