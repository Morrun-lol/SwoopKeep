// @ts-ignore
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const dbPath = join(app.getPath('userData'), 'expenses.db')
const db = new Database(dbPath)

export function initDb() {
  // 1. 确保表结构更新 (基本表结构)
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        -- project VARCHAR(50), -- 通过 migration 添加
        category VARCHAR(50) NOT NULL,
        -- sub_category VARCHAR(50), -- 通过 migration 添加
        amount DECIMAL(10, 2) NOT NULL,
        expense_date DATE NOT NULL,
        description TEXT,
        voice_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_expense_date ON expense_records(expense_date);
    CREATE INDEX IF NOT EXISTS idx_category ON expense_records(category);
    -- idx_project 移到 migration 后创建
    CREATE INDEX IF NOT EXISTS idx_created_at ON expense_records(created_at DESC);

    CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        icon VARCHAR(50),
        color VARCHAR(7) DEFAULT '#10B981',
        parent_id INTEGER,
        level INTEGER DEFAULT 2, 
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES expense_categories(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project VARCHAR(50), -- Added project field
        category VARCHAR(50) NOT NULL,
        sub_category VARCHAR(50), -- Added sub_category field
        budget_amount DECIMAL(10, 2) NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project, category, sub_category, year, month) -- Updated UNIQUE constraint
    );

    CREATE TABLE IF NOT EXISTS year_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        project VARCHAR(50),
        category VARCHAR(50),
        sub_category VARCHAR(50),
        goal_amount DECIMAL(10, 2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, project, category, sub_category)
    );

    CREATE TABLE IF NOT EXISTS import_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name VARCHAR(255) NOT NULL,
        import_type VARCHAR(50) NOT NULL, -- 'expense' | 'budget'
        record_count INTEGER NOT NULL,
        import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'success',
        total_rows INTEGER DEFAULT 0,
        processed_rows INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        file_size_bytes INTEGER DEFAULT 0,
        error_message TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS expense_hierarchy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project VARCHAR(50),
        category VARCHAR(50),
        sub_category VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project, category, sub_category)
    );

    -- Family & Member Schema
    CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name)
    );

    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL,
        family_id INTEGER,
        avatar VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
        UNIQUE(name, family_id)
    );

    -- Expense Types Schema
    CREATE TABLE IF NOT EXISTS budget_expense_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure expense_records has member_id
    -- expense_records table definition updated above conceptually, but handled via migration below
  `)

    // 2. 检查并添加新字段 (Migration)
    try {
        const tableInfo = db.prepare('PRAGMA table_info(families)').all() as any[]
        // Ensure name is unique in existing tables (for old schema without UNIQUE constraint if any)
        // Since we cannot easily ADD CONSTRAINT in SQLite, we rely on CREATE TABLE IF NOT EXISTS.
        // But if table exists without UNIQUE, it won't be updated.
        // So we create a unique index.
        db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_family_name ON families(name)').run()
        
        const memberTableInfo = db.prepare('PRAGMA table_info(members)').all() as any[]
        // 确保 member name is unique per family
        db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_member_name_family ON members(name, family_id)').run()

    // 3. Fix year_goals duplicates and uniqueness (User reported bug)
        // First, convert NULLs to empty strings to ensure consistency for UNIQUE constraint
        db.prepare("UPDATE year_goals SET project = '' WHERE project IS NULL").run()
        db.prepare("UPDATE year_goals SET sub_category = '' WHERE sub_category IS NULL").run()
        
        // Remove duplicates keeping the latest one (based on ID usually, or max ID)
        db.exec(`
            DELETE FROM year_goals 
            WHERE id NOT IN (
                SELECT MAX(id) 
                FROM year_goals 
                GROUP BY year, project, category, sub_category
            )
        `)
        
        // RECREATE TABLE year_goals to remove old constraint and add member_id properly
        // Check if member_id column exists or if we need to force migration
        // We can check if the current schema has member_id in UNIQUE constraint. 
        // A simple way is to check pragma index_list or just force migration if we detect old structure.
        // Or simpler: Just do it safely.
        
        const goalsTableInfo = db.prepare('PRAGMA table_info(year_goals)').all() as any[]
        const hasMemberIdInGoals = goalsTableInfo.some(col => col.name === 'member_id')
        const hasExpenseTypeInGoals = goalsTableInfo.some(col => col.name === 'expense_type')

        // We assume if member_id is missing, OR if the UNIQUE constraint is wrong, we need to migrate.
        // How to detect if UNIQUE constraint is wrong? 
        // We can check indexes.
        const indexes = db.prepare('PRAGMA index_list(year_goals)').all() as any[]
        // If there is an index that is UNIQUE and does NOT contain member_id, we might be in trouble.
        // But simpler is to check if we have already migrated to the new schema.
        // Let's rely on a flag or just check if member_id exists. If it was added via ALTER, the old constraint persists.
        // So checking for member_id column existence is NOT enough if we did ALTER previously.
        
        // Let's check if the table definition contains "UNIQUE(year, project, category, sub_category)" WITHOUT member_id
        const tableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='year_goals'").get() as any).sql;
        
        const needsRecreate = !tableSql.includes('member_id') || tableSql.includes('UNIQUE(year, project, category, sub_category)')

        if (needsRecreate) {
             console.log('Recreating year_goals table to fix constraints...')
             
             // 1. Rename old table
             db.prepare('DROP TABLE IF EXISTS year_goals_old').run()
             db.prepare('ALTER TABLE year_goals RENAME TO year_goals_old').run()
             
             // 2. Create new table
             db.exec(`
                CREATE TABLE year_goals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    year INTEGER NOT NULL,
                    project VARCHAR(50) DEFAULT '',
                    category VARCHAR(50) DEFAULT '',
                    sub_category VARCHAR(50) DEFAULT '',
                    goal_amount DECIMAL(10, 2) NOT NULL,
                    expense_type VARCHAR(20) DEFAULT '常规费用',
                    member_id INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(year, project, category, sub_category, member_id)
                );
             `)
             
             // 3. Migrate data
             // Handle columns mapping. Old table might or might not have expense_type / member_id depending on previous migrations.
             // We use pragma to check columns in year_goals_old
             const oldColumns = (db.prepare('PRAGMA table_info(year_goals_old)').all() as any[]).map(c => c.name)
             
             let selectColumns = 'year, project, category, sub_category, goal_amount'
             if (oldColumns.includes('expense_type')) selectColumns += ', expense_type'
             else selectColumns += ", '常规费用'"
             
             if (oldColumns.includes('member_id')) selectColumns += ', member_id'
             else selectColumns += ', 0'
             
             if (oldColumns.includes('created_at')) selectColumns += ', created_at'
             else selectColumns += ', CURRENT_TIMESTAMP'

             db.exec(`
                INSERT INTO year_goals (year, project, category, sub_category, goal_amount, expense_type, member_id, created_at)
                SELECT ${selectColumns} FROM year_goals_old
             `)
             
             // 4. Drop old table
             db.prepare('DROP TABLE year_goals_old').run()
             
             console.log('year_goals table recreated successfully.')
        }

    } catch (e) {
        console.error('Index migration failed:', e)
    }

  try {
    const tableInfo = db.prepare('PRAGMA table_info(expense_records)').all() as any[]
    const hasProject = tableInfo.some(col => col.name === 'project')
    const hasSubCategory = tableInfo.some(col => col.name === 'sub_category')
    const hasImportId = tableInfo.some(col => col.name === 'import_id')
    const hasMemberId = tableInfo.some(col => col.name === 'member_id')

    // Migration for monthly_budgets
    const budgetTableInfo = db.prepare('PRAGMA table_info(monthly_budgets)').all() as any[]
    const budgetHasProject = budgetTableInfo.some(col => col.name === 'project')
    
    if (!budgetHasProject) {
        // SQLite doesn't support adding columns with UNIQUE constraint easily in one go, 
        // but adding columns is fine. The UNIQUE constraint on existing table won't update automatically.
        // For simplicity in this dev environment, we add columns. 
        // Real prod migration might need table recreation if constraint needs enforcement on new fields.
        try {
           db.prepare('ALTER TABLE monthly_budgets ADD COLUMN project VARCHAR(50)').run()
           db.prepare('ALTER TABLE monthly_budgets ADD COLUMN sub_category VARCHAR(50)').run()
        } catch (e) {
           // Ignore if already exists (though check above should prevent)
        }
    }

    if (!hasProject) {
      db.prepare('ALTER TABLE expense_records ADD COLUMN project VARCHAR(50)').run()
      db.prepare('CREATE INDEX IF NOT EXISTS idx_project ON expense_records(project)').run()
    }
    if (!hasSubCategory) {
      db.prepare('ALTER TABLE expense_records ADD COLUMN sub_category VARCHAR(50)').run()
    }
    if (!hasImportId) {
        db.prepare('ALTER TABLE expense_records ADD COLUMN import_id INTEGER').run()
        db.prepare('CREATE INDEX IF NOT EXISTS idx_import_id ON expense_records(import_id)').run()
    }
    if (!hasMemberId) {
        db.prepare('ALTER TABLE expense_records ADD COLUMN member_id INTEGER').run()
        db.prepare('CREATE INDEX IF NOT EXISTS idx_member_id ON expense_records(member_id)').run()
    }
    
    // 确保 project 索引存在 (如果字段已存在但索引未创建)
    if (hasProject) {
        db.prepare('CREATE INDEX IF NOT EXISTS idx_project ON expense_records(project)').run()
    }

        const importInfo = db.prepare('PRAGMA table_info(import_history)').all() as any[]
        const importCols = new Set(importInfo.map((c: any) => c.name))
        const addCol = (name: string, def: string) => {
          if (!importCols.has(name)) db.prepare(`ALTER TABLE import_history ADD COLUMN ${name} ${def}`).run()
        }

        addCol('status', "VARCHAR(20) DEFAULT 'success'")
        addCol('total_rows', 'INTEGER DEFAULT 0')
        addCol('processed_rows', 'INTEGER DEFAULT 0')
        addCol('failed_count', 'INTEGER DEFAULT 0')
        addCol('skipped_count', 'INTEGER DEFAULT 0')
        addCol('file_size_bytes', 'INTEGER DEFAULT 0')
        addCol('error_message', 'TEXT')
        addCol('updated_at', 'DATETIME')
        addCol('finished_at', 'DATETIME')

        db.prepare(`
          UPDATE import_history
          SET updated_at = COALESCE(updated_at, import_date, CURRENT_TIMESTAMP)
        `).run()

        db.prepare('CREATE INDEX IF NOT EXISTS idx_import_history_date ON import_history(import_date)').run()
        db.prepare('CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history(status)').run()

        db.prepare(`
          UPDATE import_history
          SET status = 'failed',
              error_message = COALESCE(error_message, '导入中断'),
              finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'processing'
        `).run()
  } catch (error) {
    console.error('Migration failed:', error)
    console.error('Migration failed:', error)
  }

  // Insert default expense types if not exists
  const typeCount = db.prepare('SELECT count(*) as count FROM budget_expense_types').get() as { count: number }
  if (typeCount.count === 0) {
    const insertType = db.prepare('INSERT INTO budget_expense_types (name) VALUES (@name)')
    const types = [{ name: '常规费用' }, { name: '固定费用' }]
    types.forEach(t => insertType.run(t))
  }

  // Insert default categories if not exists
  const count = db.prepare('SELECT count(*) as count FROM expense_categories').get() as { count: number }
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO expense_categories (name, icon, color) VALUES (@name, @icon, @color)')
    const categories = [
      { name: '餐饮', icon: '🍽️', color: '#EF4444' },
      { name: '交通', icon: '🚗', color: '#3B82F6' },
      { name: '购物', icon: '🛍️', color: '#8B5CF6' },
      { name: '娱乐', icon: '🎬', color: '#F59E0B' },
      { name: '医疗', icon: '🏥', color: '#10B981' },
      { name: '教育', icon: '📚', color: '#6366F1' },
      { name: '住房', icon: '🏠', color: '#EC4899' },
      { name: '其他', icon: '📦', color: '#6B7280' }
    ]
    categories.forEach(cat => insert.run(cat))
  }
}

export default db
