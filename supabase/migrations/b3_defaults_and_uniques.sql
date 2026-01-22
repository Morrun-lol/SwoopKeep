-- B3: make defaults work under RLS + tighten uniqueness for mixed system/user rows

-- 1) Remove rows that became invisible after switching to strict RLS
delete from members
where family_id in (select id from families where owner_id is null);

delete from families where owner_id is null;

delete from expense_records where user_id is null;
delete from year_goals where user_id is null;
delete from monthly_budgets where user_id is null;
delete from import_history where user_id is null;

-- 2) Normalize nullable key columns to avoid null-driven duplicate gaps
update monthly_budgets set project = '' where project is null;
update monthly_budgets set sub_category = '' where sub_category is null;

update expense_hierarchy set project = '' where project is null;
update expense_hierarchy set category = '' where category is null;
update expense_hierarchy set sub_category = '' where sub_category is null;

update year_goals set project = '' where project is null;
update year_goals set category = '' where category is null;
update year_goals set sub_category = '' where sub_category is null;
update year_goals set member_id = 0 where member_id is null;

-- 3) Budget expense types: allow per-user custom names without global conflicts
alter table budget_expense_types drop constraint if exists budget_expense_types_name_key;

create unique index if not exists budget_expense_types_system_name_key
  on budget_expense_types (name)
  where user_id is null;

create unique index if not exists budget_expense_types_user_name_key
  on budget_expense_types (user_id, name)
  where user_id is not null;

-- 4) Expense hierarchy: ensure uniqueness for both system defaults and per-user rows
drop index if exists expense_hierarchy_user_scope_key;

create unique index if not exists expense_hierarchy_system_key
  on expense_hierarchy (project, category, sub_category)
  where user_id is null;

create unique index if not exists expense_hierarchy_user_key
  on expense_hierarchy (user_id, project, category, sub_category)
  where user_id is not null;

