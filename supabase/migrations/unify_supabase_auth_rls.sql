-- Unify strategy: Auth required + RLS per-user isolation

-- 1) Ensure ownership columns exist (idempotent)
alter table families add column if not exists owner_id uuid default auth.uid();
alter table expense_records add column if not exists user_id uuid default auth.uid();
alter table year_goals add column if not exists user_id uuid default auth.uid();
alter table monthly_budgets add column if not exists user_id uuid default auth.uid();
alter table import_history add column if not exists user_id uuid default auth.uid();
alter table expense_hierarchy add column if not exists user_id uuid default auth.uid();
alter table budget_expense_types add column if not exists user_id uuid default auth.uid();

-- 2) Drop legacy global-unique constraints that break multi-tenant usage
alter table families drop constraint if exists families_name_key;
alter table year_goals drop constraint if exists year_goals_year_project_category_sub_category_member_id_key;
alter table monthly_budgets drop constraint if exists monthly_budgets_project_category_sub_category_year_month_key;
alter table expense_hierarchy drop constraint if exists expense_hierarchy_project_category_sub_category_key;

-- 3) Recreate tenant-aware uniqueness
create unique index if not exists families_owner_id_name_key on families (owner_id, name);
create unique index if not exists year_goals_user_scope_key on year_goals (user_id, year, project, category, sub_category, member_id);
create unique index if not exists monthly_budgets_user_scope_key on monthly_budgets (user_id, project, category, sub_category, year, month);
create unique index if not exists expense_hierarchy_user_scope_key on expense_hierarchy (user_id, project, category, sub_category);

-- 4) Enforce RLS (idempotent)
alter table expense_records enable row level security;
alter table expense_categories enable row level security;
alter table monthly_budgets enable row level security;
alter table year_goals enable row level security;
alter table expense_hierarchy enable row level security;
alter table families enable row level security;
alter table members enable row level security;
alter table budget_expense_types enable row level security;
alter table import_history enable row level security;

-- 5) Remove public access policies (if any)
drop policy if exists "Enable all access" on expense_records;
drop policy if exists "Enable all access" on expense_categories;
drop policy if exists "Enable all access" on monthly_budgets;
drop policy if exists "Enable all access" on year_goals;
drop policy if exists "Enable all access" on expense_hierarchy;
drop policy if exists "Enable all access" on families;
drop policy if exists "Enable all access" on members;
drop policy if exists "Enable all access" on budget_expense_types;
drop policy if exists "Enable all access" on import_history;

-- 6) Recreate strict per-user policies (drop first for idempotency)
drop policy if exists "Users can view their own families" on families;
drop policy if exists "Users can insert their own families" on families;
drop policy if exists "Users can update their own families" on families;
drop policy if exists "Users can delete their own families" on families;

create policy "Users can view their own families" on families
  for select using (owner_id = auth.uid());

create policy "Users can insert their own families" on families
  for insert with check (owner_id = auth.uid());

create policy "Users can update their own families" on families
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Users can delete their own families" on families
  for delete using (owner_id = auth.uid());

drop policy if exists "Users can view members of their families" on members;
drop policy if exists "Users can insert members into their families" on members;
drop policy if exists "Users can update members of their families" on members;
drop policy if exists "Users can delete members of their families" on members;

create policy "Users can view members of their families" on members
  for select using (
    exists (select 1 from families where id = members.family_id and owner_id = auth.uid())
  );

create policy "Users can insert members into their families" on members
  for insert with check (
    exists (select 1 from families where id = family_id and owner_id = auth.uid())
  );

create policy "Users can update members of their families" on members
  for update using (
    exists (select 1 from families where id = members.family_id and owner_id = auth.uid())
  ) with check (
    exists (select 1 from families where id = members.family_id and owner_id = auth.uid())
  );

create policy "Users can delete members of their families" on members
  for delete using (
    exists (select 1 from families where id = members.family_id and owner_id = auth.uid())
  );

drop policy if exists "Users can manage their own expenses" on expense_records;
create policy "Users can manage their own expenses" on expense_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can manage their own year goals" on year_goals;
create policy "Users can manage their own year goals" on year_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can manage their own monthly budgets" on monthly_budgets;
create policy "Users can manage their own monthly budgets" on monthly_budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can manage their own import history" on import_history;
create policy "Users can manage their own import history" on import_history
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can view system and own hierarchy" on expense_hierarchy;
drop policy if exists "Users can insert own hierarchy" on expense_hierarchy;
drop policy if exists "Users can update own hierarchy" on expense_hierarchy;
drop policy if exists "Users can delete own hierarchy" on expense_hierarchy;

create policy "Users can view system and own hierarchy" on expense_hierarchy
  for select using (user_id is null or user_id = auth.uid());

create policy "Users can insert own hierarchy" on expense_hierarchy
  for insert with check (user_id = auth.uid());

create policy "Users can update own hierarchy" on expense_hierarchy
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can delete own hierarchy" on expense_hierarchy
  for delete using (user_id = auth.uid());

drop policy if exists "Users can view system and own expense types" on budget_expense_types;
drop policy if exists "Users can insert own expense types" on budget_expense_types;
drop policy if exists "Users can update own expense types" on budget_expense_types;

create policy "Users can view system and own expense types" on budget_expense_types
  for select using (user_id is null or user_id = auth.uid());

create policy "Users can insert own expense types" on budget_expense_types
  for insert with check (user_id = auth.uid());

create policy "Users can update own expense types" on budget_expense_types
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Anyone can view categories" on expense_categories;
create policy "Anyone can view categories" on expense_categories
  for select using (true);

