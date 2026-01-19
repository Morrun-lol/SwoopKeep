
-- Enable RLS on all tables (if not already enabled)
alter table expense_records enable row level security;
alter table expense_categories enable row level security;
alter table monthly_budgets enable row level security;
alter table year_goals enable row level security;
alter table expense_hierarchy enable row level security;
alter table families enable row level security;
alter table members enable row level security;
alter table budget_expense_types enable row level security;
alter table import_history enable row level security;

-- Drop existing "Enable all access" policies
drop policy if exists "Enable all access" on expense_records;
drop policy if exists "Enable all access" on expense_categories;
drop policy if exists "Enable all access" on monthly_budgets;
drop policy if exists "Enable all access" on year_goals;
drop policy if exists "Enable all access" on expense_hierarchy;
drop policy if exists "Enable all access" on families;
drop policy if exists "Enable all access" on members;
drop policy if exists "Enable all access" on budget_expense_types;
drop policy if exists "Enable all access" on import_history;

-- 1. Families
-- Add owner_id to associate families with users
alter table families add column if not exists owner_id uuid default auth.uid();

create policy "Users can view their own families" on families
  for select using (owner_id = auth.uid());

create policy "Users can insert their own families" on families
  for insert with check (owner_id = auth.uid());

create policy "Users can update their own families" on families
  for update using (owner_id = auth.uid());

create policy "Users can delete their own families" on families
  for delete using (owner_id = auth.uid());

-- 2. Members
-- Access controlled via family ownership
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
  );

create policy "Users can delete members of their families" on members
  for delete using (
    exists (select 1 from families where id = members.family_id and owner_id = auth.uid())
  );

-- 3. Expense Records
-- Add user_id for direct ownership and performance
alter table expense_records add column if not exists user_id uuid default auth.uid();

create policy "Users can manage their own expenses" on expense_records
  for all using (user_id = auth.uid());

-- 4. Year Goals
alter table year_goals add column if not exists user_id uuid default auth.uid();

create policy "Users can manage their own year goals" on year_goals
  for all using (user_id = auth.uid());

-- 5. Monthly Budgets
alter table monthly_budgets add column if not exists user_id uuid default auth.uid();

create policy "Users can manage their own monthly budgets" on monthly_budgets
  for all using (user_id = auth.uid());

-- 6. Import History
alter table import_history add column if not exists user_id uuid default auth.uid();

create policy "Users can manage their own import history" on import_history
  for all using (user_id = auth.uid());

-- 7. Expense Hierarchy
alter table expense_hierarchy add column if not exists user_id uuid default auth.uid();

-- Allow reading system defaults (user_id is null) + user's own
create policy "Users can view system and own hierarchy" on expense_hierarchy
  for select using (user_id is null or user_id = auth.uid());

create policy "Users can insert own hierarchy" on expense_hierarchy
  for insert with check (user_id = auth.uid());

create policy "Users can update own hierarchy" on expense_hierarchy
  for update using (user_id = auth.uid());

create policy "Users can delete own hierarchy" on expense_hierarchy
  for delete using (user_id = auth.uid());

-- 8. Budget Expense Types
alter table budget_expense_types add column if not exists user_id uuid default auth.uid();

create policy "Users can view system and own expense types" on budget_expense_types
  for select using (user_id is null or user_id = auth.uid());

create policy "Users can insert own expense types" on budget_expense_types
  for insert with check (user_id = auth.uid());

create policy "Users can update own expense types" on budget_expense_types
  for update using (user_id = auth.uid());

-- 9. Expense Categories
-- Assume these are system-wide for now (read-only for users)
-- Or add user_id if we want custom categories. For now, let's keep it simple: Read all, Write none (except admin/system)
create policy "Anyone can view categories" on expense_categories
  for select using (true);
  
-- If we want users to add categories later, we'd add user_id.

