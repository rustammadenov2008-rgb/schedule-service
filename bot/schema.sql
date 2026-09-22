-- ============================================================
-- Схема базы данных для сервиса расписания (Supabase / Postgres)
-- Выполните этот файл целиком в Supabase → SQL Editor → New query
-- ============================================================

-- Таблица групп
create table if not exists groups (
  id   bigserial primary key,
  name text not null unique
);

-- Таблица расписания
create table if not exists schedule (
  id            bigserial primary key,
  group_id      bigint references groups(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 1 and 6), -- 1=Пн ... 6=Сб
  lesson_number smallint not null,
  subject_name  text not null,
  time_start    time not null,
  time_end      time not null
);

-- Разрешаем публичное чтение (для демо-проекта; в реальном
-- продакшене доступ обычно ограничивают через RLS-политики)
alter table groups enable row level security;
alter table schedule enable row level security;

create policy "Public read groups" on groups
  for select using (true);

create policy "Public read schedule" on schedule
  for select using (true);

-- ============================================================
-- Тестовые данные для двух групп
-- ============================================================

insert into groups (name) values
  ('ВЕБ-21'),
  ('ИС-22')
on conflict (name) do nothing;

-- Расписание для ВЕБ-21 (понедельник и вторник)
insert into schedule (group_id, day_of_week, lesson_number, subject_name, time_start, time_end)
select id, 1, 1, 'Веб-разработка', '08:30', '09:50' from groups where name = 'ВЕБ-21'
union all
select id, 1, 2, 'Веб-разработка', '09:55', '11:15' from groups where name = 'ВЕБ-21'
union all
select id, 1, 3, 'Базы данных',    '11:25', '12:45' from groups where name = 'ВЕБ-21'
union all
select id, 2, 1, 'Английский язык','08:30', '09:50' from groups where name = 'ВЕБ-21'
union all
select id, 2, 2, 'Физкультура',    '09:55', '11:15' from groups where name = 'ВЕБ-21';

-- Расписание для ИС-22 (понедельник и вторник)
insert into schedule (group_id, day_of_week, lesson_number, subject_name, time_start, time_end)
select id, 1, 1, 'Информационные системы', '08:30', '09:50' from groups where name = 'ИС-22'
union all
select id, 1, 2, 'Математика',             '09:55', '11:15' from groups where name = 'ИС-22'
union all
select id, 2, 1, 'Сети и протоколы',       '08:30', '09:50' from groups where name = 'ИС-22';
