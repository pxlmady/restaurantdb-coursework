/* =====================================================================
   Відновлення RestaurantDB з бекапу database/backup/RestaurantDB.bak
   Запускається сервісом db-init з docker-compose.yml.
   Якщо база вже існує, скрипт нічого не робить: наявні дані не перезаписуються.
   ===================================================================== */

IF DB_ID(N'RestaurantDB') IS NOT NULL
BEGIN
    PRINT N'База RestaurantDB уже існує, відновлення пропущено.';
END
ELSE
BEGIN
    -- Логічні імена файлів узято з RESTORE FILELISTONLY; шляхи замінюємо на Linux-шляхи контейнера
    RESTORE DATABASE RestaurantDB
    FROM DISK = N'/backup/RestaurantDB.bak'
    WITH MOVE N'RestaurantDB'     TO N'/var/opt/mssql/data/RestaurantDB.mdf',
         MOVE N'RestaurantDB_log' TO N'/var/opt/mssql/data/RestaurantDB_log.ldf',
         STATS = 25;

    -- Власником у бекапі є Windows-обліковий запис, якого в контейнері немає; передаємо базу sa
    ALTER AUTHORIZATION ON DATABASE::RestaurantDB TO sa;

    PRINT N'Базу RestaurantDB відновлено з бекапу.';
END;
GO
