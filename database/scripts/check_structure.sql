/* =====================================================================
   Знімок фактичної структури бази RestaurantDB
   Лише читає системні представлення sys.*; нічого в базі не змінює.
   Основа: bd/00_check_structure.sql (той самий набір запитів, інша база).
   Запускається сервісом db-init з docker-compose.yml, результат:
   database/reports/check_structure.txt
   ===================================================================== */

SET NOCOUNT ON;
USE RestaurantDB;
GO

-- 0. Яка це база і на якому сервері (щоб не сплутати з іншою копією)
SELECT DB_NAME() AS [database], @@SERVERNAME AS [server],
       SERVERPROPERTY('ProductVersion') AS [sql_version];

-- 1. Таблиці та стовпці: тип, довжина, NULL, IDENTITY
SELECT t.name AS [table], c.column_id AS [#], c.name AS [column],
       TYPE_NAME(c.user_type_id) AS [type],
       CASE WHEN TYPE_NAME(c.user_type_id) IN ('nvarchar','nchar') AND c.max_length > 0
            THEN c.max_length / 2 ELSE c.max_length END AS [length],
       c.precision, c.scale, c.is_nullable, c.is_identity
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
ORDER BY t.name, c.column_id;

-- 2. Обмеження: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, DEFAULT
SELECT OBJECT_NAME(o.parent_object_id) AS [table], o.name, o.type_desc,
       COALESCE(cc.definition, dc.definition) AS [definition]
FROM sys.objects o
LEFT JOIN sys.check_constraints   cc ON cc.object_id = o.object_id
LEFT JOIN sys.default_constraints dc ON dc.object_id = o.object_id
WHERE o.type IN ('PK','F','UQ','C','D')
ORDER BY [table], o.type_desc, o.name;

-- 3. Зв'язки (FOREIGN KEY): звідки -> куди і що буде при видаленні/оновленні
SELECT fk.name,
       OBJECT_NAME(fk.parent_object_id) AS [from_table],
       COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS [from_column],
       OBJECT_NAME(fk.referenced_object_id) AS [to_table],
       COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS [to_column],
       fk.delete_referential_action_desc AS [on_delete],
       fk.update_referential_action_desc AS [on_update]
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
ORDER BY [from_table], fk.name;

-- 4. Індекси (крім куп) і їхні стовпці
SELECT OBJECT_NAME(i.object_id) AS [table], i.name AS [index], i.type_desc,
       i.is_primary_key, i.is_unique,
       STRING_AGG(COL_NAME(ic.object_id, ic.column_id), ', ')
           WITHIN GROUP (ORDER BY ic.key_ordinal) AS [columns]
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1 AND i.type > 0
GROUP BY i.object_id, i.name, i.type_desc, i.is_primary_key, i.is_unique
ORDER BY [table], [index];

-- 5. Програмні об'єкти: представлення, процедури, функції, тригери
SELECT o.name, o.type_desc, OBJECT_NAME(o.parent_object_id) AS [parent_table],
       o.create_date, o.modify_date
FROM sys.objects o
WHERE o.type IN ('V','P','FN','IF','TF','TR')
ORDER BY o.type_desc, o.name;

-- 6. Кількість рядків у кожній таблиці
SELECT t.name AS [table], SUM(p.rows) AS [rows]
FROM sys.tables t
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY t.name
ORDER BY t.name;

-- 7. Властивості бази: збірання, рівень сумісності, власник
SELECT d.name AS [database], d.collation_name, d.compatibility_level,
       d.recovery_model_desc, SUSER_SNAME(d.owner_sid) AS [owner]
FROM sys.databases d
WHERE d.name = DB_NAME();
