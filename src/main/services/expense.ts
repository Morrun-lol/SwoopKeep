import db from '../db'

export interface ExpenseRecord {
  id?: number
  project?: string
  category: string
  sub_category?: string
  amount: number
  expense_date: string
  description: string
  voice_text?: string
  member_id?: number
  import_id?: number
  created_at?: string
  updated_at?: string
}

export interface ExpenseCategory {
  id?: number
  name: string
  icon?: string
  color?: string
  parent_id?: number
  is_active?: boolean
  level?: number
}

export interface YearGoal {
  id?: number
  year: number
  project?: string
  category?: string
  sub_category?: string
  goal_amount: number
  expense_type?: string
  member_id?: number
}

export interface BudgetExpenseType {
  id: number
  name: string
  is_active: number // SQLite boolean is 0 or 1
}

export function createExpense(data: ExpenseRecord): number {
  const stmt = db.prepare(`
    INSERT INTO expense_records (project, category, sub_category, amount, expense_date, description, voice_text, member_id, import_id)
    VALUES (@project, @category, @sub_category, @amount, @expense_date, @description, @voice_text, @member_id, @import_id)
  `)
  const result = stmt.run({
    project: data.project || null,
    category: data.category,
    sub_category: data.sub_category || null,
    amount: data.amount,
    expense_date: data.expense_date,
    description: data.description,
    voice_text: data.voice_text || '',
    member_id: data.member_id || null,
    import_id: data.import_id || null
  })
  return result.lastInsertRowid as number
}

export function getExpensesByDateRange(startDate: string, endDate: string): ExpenseRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM expense_records
    WHERE expense_date BETWEEN @startDate AND @endDate
    ORDER BY expense_date DESC, created_at DESC
  `)
  return stmt.all({ startDate, endDate }) as ExpenseRecord[]
}

export function getExpensesByCategory(category: string, limit?: number): ExpenseRecord[] {
  let query = `
    SELECT * FROM expense_records
    WHERE category = @category
    ORDER BY expense_date DESC
  `
  if (limit) {
    query += ` LIMIT @limit`
  }
  const stmt = db.prepare(query)
  return limit ? stmt.all({ category, limit }) : stmt.all({ category }) as ExpenseRecord[]
}

export function getExpenseById(id: number): ExpenseRecord | undefined {
  const stmt = db.prepare('SELECT * FROM expense_records WHERE id = @id')
  return stmt.get({ id }) as ExpenseRecord | undefined
}

export function updateExpense(id: number, data: Partial<ExpenseRecord>): boolean {
  const fields: string[] = []
  const params: any = { id }

  Object.keys(data).forEach(key => {
    if (data[key as keyof ExpenseRecord] !== undefined) {
      fields.push(`${key} = @${key}`)
      params[key] = data[key as keyof ExpenseRecord]
    }
  })

  if (fields.length === 0) return false

  const stmt = db.prepare(`
    UPDATE expense_records
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `)
  const result = stmt.run(params)
  return result.changes > 0
}

export function deleteExpense(id: number): boolean {
  const stmt = db.prepare('DELETE FROM expense_records WHERE id = @id')
  const result = stmt.run({ id })
  return result.changes > 0
}

export function clearAllData(): boolean {
  try {
    // 开启事务
    db.exec('BEGIN TRANSACTION')
    
    // 清空相关表
    db.prepare('DELETE FROM expense_records').run()
    db.prepare('DELETE FROM import_history').run()
    db.prepare('DELETE FROM year_goals').run()
    db.prepare('DELETE FROM monthly_budgets').run()
    // 不清空 families 和 members，以免影响基础配置，但如果用户强烈要求，可以后续添加
    // 不清空 expense_categories，这是基础数据
    // 不清空 expense_hierarchy，这是分类字典
    
    // 重置自增 ID (可选)
    db.prepare("DELETE FROM sqlite_sequence WHERE name='expense_records'").run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name='import_history'").run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name='year_goals'").run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name='monthly_budgets'").run()
    
    db.exec('COMMIT')
    return true
  } catch (error) {
    db.exec('ROLLBACK')
    console.error('Failed to clear data:', error)
    return false
  }
}

export function getAllCategories(): ExpenseCategory[] {
  const stmt = db.prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name')
  return stmt.all() as ExpenseCategory[]
}

export function getCategoryByName(name: string): ExpenseCategory | undefined {
  const stmt = db.prepare('SELECT * FROM expense_categories WHERE name = @name AND is_active = 1')
  return stmt.get({ name }) as ExpenseCategory | undefined
}

// 统计分析：按分类汇总 (Pie Chart)
// level: 'project' | 'category' | 'sub_category'
export function getExpenseComposition(startDate: string, endDate: string, level: string = 'category', parentValue?: string) {
  let groupBy = 'category'
  let whereClause = 'expense_date BETWEEN @startDate AND @endDate'
  const params: any = { startDate, endDate }

  if (level === 'project') {
    groupBy = 'project'
  } else if (level === 'sub_category') {
    groupBy = 'sub_category'
    if (parentValue) {
      // 如果查询子分类，通常是点击了某个分类后的钻取
      // 这里假设父级是 category
      whereClause += ' AND category = @parentValue'
      params.parentValue = parentValue
    }
  }

  // 使用 IFNULL/COALESCE 将空项目/空分类处理为默认值，避免被忽略
  let selectClause = `${groupBy} as name`
  let groupByClause = groupBy
  
  if (groupBy === 'project') {
    selectClause = `CASE WHEN project IS NULL OR project = '' THEN '默认项目' ELSE project END as name`
    groupByClause = `CASE WHEN project IS NULL OR project = '' THEN '默认项目' ELSE project END`
  }

  const stmt = db.prepare(`
    SELECT 
      ${selectClause},
      SUM(amount) as value,
      COUNT(*) as count
    FROM expense_records
    WHERE ${whereClause}
    GROUP BY ${groupByClause}
    ORDER BY value DESC
  `)
  
  return stmt.all(params)
}

// 统计分析：趋势图 (Line Chart)
// dimension: 'day' | 'week' | 'month' | 'quarter' | 'year'
// filter: { type: 'category' | 'project' | 'sub_category', value: string }
export function getExpenseTrend(
  startDate: string, 
  endDate: string, 
  dimension: string = 'day', 
  filter?: { type: string, value: string }
) {
  let dateFormat = '%Y-%m-%d' // day
  
  switch(dimension) {
    case 'week':
      dateFormat = '%Y-%W'
      break
    case 'month':
      dateFormat = '%Y-%m'
      break
    case 'year':
      dateFormat = '%Y'
      break
    case 'quarter':
      // SQLite 没有直接的 quarter 函数，需特殊处理，这里暂时用月份模拟或复杂 SQL
      // 简单起见，按月返回，前端聚合，或者这里写复杂 SQL
      // 复杂 SQL 方案:
      // strftime('%Y', expense_date) || '-Q' || ((strftime('%m', expense_date) + 2) / 3)
      dateFormat = 'quarter' 
      break
  }

  let dateCol = `strftime('${dateFormat}', expense_date)`
  if (dimension === 'quarter') {
    dateCol = `strftime('%Y', expense_date) || '-Q' || cast((strftime('%m', expense_date) + 2) / 3 as int)`
  }

  let whereClause = 'expense_date BETWEEN @startDate AND @endDate'
  const params: any = { startDate, endDate }

  if (filter && filter.value) {
    whereClause += ` AND ${filter.type} = @filterValue`
    params.filterValue = filter.value
  }

  const stmt = db.prepare(`
    SELECT 
      ${dateCol} as date,
      SUM(amount) as amount
    FROM expense_records
    WHERE ${whereClause}
    GROUP BY date
    ORDER BY date ASC
  `)

  return stmt.all(params)
}

// 预算目标：获取
export function getYearGoals(year: number, memberId?: number) {
  let query = 'SELECT * FROM year_goals WHERE year = @year'
  if (memberId !== undefined) {
    query += ' AND member_id = @memberId'
  } else {
    // memberId undefined means Family (null) or All?
    // Based on requirement "Data Isolation", usually we select specifically.
    // If selectedLedger is Family, memberId is undefined/null.
    // In DB, Family goals have member_id = 0 (based on migration).
    query += ' AND member_id = 0'
  }
  const stmt = db.prepare(query)
  // Use 0 if memberId is undefined/null for query param if we changed logic above
  // But here we hardcoded 0 in SQL string for else case.
  return stmt.all({ year, memberId }) as YearGoal[]
}

// 预算目标：保存
export function saveYearGoal(goal: YearGoal) {
  const stmt = db.prepare(`
    INSERT INTO year_goals (year, project, category, sub_category, goal_amount, expense_type, member_id)
    VALUES (@year, @project, @category, @sub_category, @goal_amount, @expense_type, @member_id)
    ON CONFLICT(year, project, category, sub_category, member_id) 
    DO UPDATE SET goal_amount = @goal_amount, expense_type = @expense_type, created_at = CURRENT_TIMESTAMP
  `)
  
  const member_id = goal.member_id || 0 // Default to 0 (Family)

  stmt.run({
    year: goal.year,
    project: goal.project || '',
    category: goal.category || '',
    sub_category: goal.sub_category || '',
    goal_amount: goal.goal_amount,
    expense_type: goal.expense_type || '常规费用',
    member_id
  })

  // Return the full list for the year
  return getYearGoals(goal.year, member_id)
}

// 预算目标：对比分析
export function getGoalComparison(year: number, startDate?: string, endDate?: string, memberId?: number) {
  // 默认全年
  const start = startDate || `${year}-01-01`
  const end = endDate || `${year}-12-31`
  
  // Filter actuals by member_id
  let actualQuery = `
    SELECT 
      sub_category,
      category,
      project,
      SUM(amount) as actual_amount
    FROM expense_records
    WHERE expense_date BETWEEN @start AND @end
  `
  
  if (memberId !== undefined) {
    actualQuery += ` AND member_id = @memberId`
  } else {
    // If memberId is undefined (Family), do we include all family members expenses?
    // Usually "Family Ledger" includes everything or just shared?
    // Expense records usually have member_id.
    // If we view "Family" budget, we probably want ALL expenses in that family context?
    // Or only expenses marked as "Family" (member_id is null/0)?
    // Requirement says "Member-specific budget".
    // Implies "Family" is an aggregate or a specific shared ledger.
    // Let's assume "Family" view aggregates everything OR specific shared expenses.
    // Given the "Home" page selector "Family Shared", it likely implies specific shared items.
    // BUT usually expenses are made by members.
    // Let's stick to: If memberId is provided, filter by it. If not, include ALL?
    // No, if I select "Family", I expect to see expenses that count towards Family Budget.
    // For now, let's assume "Family" (memberId=undefined) means NO filter (All expenses).
    // Wait, if I have separate budgets for Member A, I don't want Member A's expenses to eat into Family Budget if Family Budget is separate.
    // User requirement: "Ensure data isolation".
    // So Member A expenses -> Member A Budget.
    // Family expenses -> Family Budget.
    // So we should filter by member_id = 0 (or NULL) for Family?
    // Let's assume member_id=0/NULL is "Shared".
    // But currently expense_records might have member_id of the creator.
    // This is complex. Let's assume for now:
    // If memberId is passed, filter by it.
    // If NOT passed, it implies "Global" or "Shared".
    // Let's use `member_id IS NULL OR member_id = 0` for Family?
    // Let's check `getTotalAmountByDateRange` implementation.
    // It checks `if (memberId !== undefined)`.
    // So if I pass undefined, it gets EVERYTHING.
    // This implies Family View = All Data.
    // So for Goal Comparison, if memberId is undefined, we get ALL expenses.
    // And we compare against Family Goals (member_id=0).
    // This might be mismatched (All Expenses vs Shared Goals).
    // But if individual budgets are "subsets", maybe Family Budget is the "Master" budget?
    // Let's stick to the existing pattern: memberId undefined -> All.
  }

  actualQuery += ` GROUP BY sub_category, category, project`

  const actualStmt = db.prepare(actualQuery)
  const actuals = actualStmt.all({ start, end, memberId }) as any[]
  
  // Get goals for specific member (or Family default 0)
  const targetMemberId = memberId || 0
  const goals = getYearGoals(year, targetMemberId)
  
  // ... (rest of logic same) ...
  const map = new Map<string, any>()
  
  goals.forEach(g => {
    const key = `${g.project || ''}-${g.category || ''}-${g.sub_category || ''}`
    map.set(key, { 
      project: g.project, 
      category: g.category, 
      sub_category: g.sub_category, 
      goal: g.goal_amount, 
      expense_type: g.expense_type || '常规费用',
      actual: 0 
    })
  })
  
  actuals.forEach(a => {
    const key = `${a.project || ''}-${a.category || ''}-${a.sub_category || ''}`
    if (map.has(key)) {
      map.get(key).actual = a.actual_amount
    } else {
      // Only add non-goal items if we are not strictly filtering? 
      // Or always add them?
      map.set(key, {
        project: a.project,
        category: a.category,
        sub_category: a.sub_category,
        goal: 0,
        expense_type: '常规费用', // Default for items without goals
        actual: a.actual_amount
      })
    }
  })
  
  return Array.from(map.values())
}

export function getStatisticsByDateRange(startDate: string, endDate: string) {
  const stmt = db.prepare(`
    SELECT 
      category,
      SUM(amount) as total_amount,
      COUNT(*) as count
    FROM expense_records
    WHERE expense_date BETWEEN @startDate AND @endDate
    GROUP BY category
    ORDER BY total_amount DESC
  `)
  return stmt.all({ startDate, endDate })
}

export function getDailyStatistics(startDate: string, endDate: string) {
  const stmt = db.prepare(`
    SELECT 
      expense_date,
      SUM(amount) as total_amount,
      COUNT(*) as count
    FROM expense_records
    WHERE expense_date BETWEEN @startDate AND @endDate
    GROUP BY expense_date
    ORDER BY expense_date DESC
  `)
  return stmt.all({ startDate, endDate })
}

export function getTotalAmountByDateRange(startDate: string, endDate: string, memberId?: number) {
  let query = `
    SELECT 
      SUM(amount) as total_amount,
      COUNT(*) as total_count
    FROM expense_records
    WHERE expense_date BETWEEN @startDate AND @endDate
  `
  
  if (memberId !== undefined) {
    query += ` AND member_id = @memberId`
  }

  const stmt = db.prepare(query)
  return stmt.get({ startDate, endDate, memberId }) as { total_amount: number, total_count: number }
}

export function getMonthlyStatistics(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`

  return {
    byCategory: getStatisticsByDateRange(startDate, endDate),
    byDay: getDailyStatistics(startDate, endDate),
    total: getTotalAmountByDateRange(startDate, endDate)
  }
}

export function getRecentExpenses(limit: number = 10, memberId?: number): ExpenseRecord[] {
  let query = `
    SELECT * FROM expense_records
  `
  
  if (memberId !== undefined) {
    query += ` WHERE member_id = @memberId`
  }

  query += ` ORDER BY created_at DESC LIMIT @limit`

  const stmt = db.prepare(query)
  return stmt.all({ limit, memberId }) as ExpenseRecord[]
}

export function searchExpenses(keyword: string): ExpenseRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM expense_records
    WHERE description LIKE @keyword OR voice_text LIKE @keyword OR sub_category LIKE @keyword OR project LIKE @keyword
    ORDER BY expense_date DESC, created_at DESC
  `)
  return stmt.all({ keyword: `%${keyword}%` }) as ExpenseRecord[]
}

export function getExpenseStructure() {
  // 使用 IFNULL/COALESCE 处理空项目，将其归类为 '默认项目'
  // 注意：UNION 会自动去重
  const stmt = db.prepare(`
    SELECT DISTINCT 
      CASE WHEN project IS NULL OR project = '' THEN '默认项目' ELSE project END as project,
      category, 
      sub_category 
    FROM expense_records 
    UNION
    SELECT DISTINCT 
      CASE WHEN project IS NULL OR project = '' THEN '默认项目' ELSE project END as project, 
      category, 
      sub_category
    FROM expense_hierarchy
    UNION
    SELECT DISTINCT 
      CASE WHEN project IS NULL OR project = '' THEN '默认项目' ELSE project END as project, 
      category, 
      sub_category
    FROM year_goals
    UNION
    SELECT DISTINCT 
      CASE WHEN project IS NULL OR project = '' THEN '默认项目' ELSE project END as project, 
      category, 
      sub_category
    FROM monthly_budgets
    ORDER BY project, category, sub_category
  `)
  return stmt.all() as { project: string, category: string, sub_category: string }[]
}

export function addExpenseHierarchyItem(project: string, category: string, sub_category: string) {
  try {
    const stmt = db.prepare(`
      INSERT INTO expense_hierarchy (project, category, sub_category)
      VALUES (@project, @category, @sub_category)
      ON CONFLICT(project, category, sub_category) DO NOTHING
    `)
    stmt.run({ project, category, sub_category })
    return true
  } catch (e) {
    console.error('Failed to add expense hierarchy item:', e)
    return false
  }
}

// Import History Management
export function addImportHistory(fileName: string, type: string, count: number): number {
  const stmt = db.prepare(`
    INSERT INTO import_history (file_name, import_type, record_count)
    VALUES (@fileName, @type, @count)
  `)
  const result = stmt.run({ fileName, type, count })
  return result.lastInsertRowid as number
}

export function getImportHistory() {
  const stmt = db.prepare(`
    SELECT * FROM import_history ORDER BY import_date DESC
  `)
  return stmt.all()
}

export function updateImportHistoryCount(id: number, count: number) {
  const stmt = db.prepare(`
    UPDATE import_history SET record_count = @count WHERE id = @id
  `)
  stmt.run({ id, count })
}

export function deleteImportRecord(id: number): boolean {
  try {
    db.exec('BEGIN TRANSACTION')
    
    // 1. Delete associated expense records
    db.prepare('DELETE FROM expense_records WHERE import_id = ?').run(id)
    
    // 2. Delete the history record
    const result = db.prepare('DELETE FROM import_history WHERE id = ?').run(id)
    
    db.exec('COMMIT')
    return result.changes > 0
  } catch (error) {
    db.exec('ROLLBACK')
    console.error('Failed to delete import record:', error)
    return false
  }
}

export function cleanDuplicateExpenses(): number {
  try {
    // 使用临时表方法删除重复数据，更稳健
    // 1. 找出所有重复组中 id 最小的记录保留
    // 2. 删除其余的
    
    // 注意：GROUP BY 中 NULL 值处理。SQLite 中 GROUP BY 会把 NULL 视为相等。
    // 我们需要确保所有关键字段都参与比较。
    
    const stmt = db.prepare(`
      DELETE FROM expense_records
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM expense_records
        GROUP BY 
          IFNULL(project, ''), 
          category, 
          IFNULL(sub_category, ''), 
          amount, 
          expense_date, 
          description, 
          IFNULL(member_id, -1)
      )
    `)
    const result = stmt.run()
    console.log(`[Clean Duplicates] Deleted ${result.changes} rows`)
    return result.changes
  } catch (error) {
    console.error('Failed to clean duplicate expenses:', error)
    return 0
  }
}

export function deleteYearGoal(id: number, year: number, memberId?: number): YearGoal[] {
  try {
    db.prepare('DELETE FROM year_goals WHERE id = ?').run(id)
    // 直接返回当年的最新数据
    return getYearGoals(year, memberId)
  } catch (error) {
    console.error('Failed to delete year goal:', error)
    return getYearGoals(year, memberId) // 即使删除失败，也返回当前状态
  }
}

// 费用类型管理
export function getAllExpenseTypes(): BudgetExpenseType[] {
  const stmt = db.prepare('SELECT * FROM budget_expense_types ORDER BY id')
  return stmt.all() as BudgetExpenseType[]
}

export function addExpenseType(name: string): boolean {
  try {
    const stmt = db.prepare('INSERT INTO budget_expense_types (name) VALUES (@name)')
    stmt.run({ name })
    return true
  } catch (error) {
    console.error('Failed to add expense type:', error)
    return false
  }
}

export function updateExpenseType(id: number, name: string): boolean {
  try {
    const stmt = db.prepare('UPDATE budget_expense_types SET name = @name WHERE id = @id')
    const result = stmt.run({ id, name })
    return result.changes > 0
  } catch (error) {
    console.error('Failed to update expense type:', error)
    return false
  }
}

export function toggleExpenseType(id: number, isActive: boolean): boolean {
  try {
    const stmt = db.prepare('UPDATE budget_expense_types SET is_active = @isActive WHERE id = @id')
    const result = stmt.run({ id, isActive: isActive ? 1 : 0 })
    return result.changes > 0
  } catch (error) {
    console.error('Failed to toggle expense type:', error)
    return false
  }
}

