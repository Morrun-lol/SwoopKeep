import { app, shell, BrowserWindow, ipcMain, session, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { parseExpense, checkConnection } from './services/llm'
import { startVoiceRecognition, testConnection } from './services/voice-recognition'
import {
  createExpense,
  getExpensesByDateRange,
  getExpenseById,
  updateExpense,
  deleteExpense,
  cleanDuplicateExpenses,
  getAllCategories,
  getStatisticsByDateRange,
  getDailyStatistics,
  getTotalAmountByDateRange,
  getMonthlyStatistics,
  getRecentExpenses,
  searchExpenses,
  getExpenseComposition,
  getExpenseTrend,
  getYearGoals,
  saveYearGoal,
  deleteYearGoal,
  getGoalComparison,
  clearAllData,
  addImportHistory,
  getImportHistory,
  deleteImportRecord,
  updateImportHistoryCount,
  updateImportHistoryProgress,
  rollbackImportExpenses,
  addExpenseHierarchyItem,
  getExpenseStructure,
  getAllExpenseTypes,
  addExpenseType,
  updateExpenseType,
  toggleExpenseType,
  getMonthlyBudgets,
  saveMonthlyBudget,
  deleteMonthlyBudget
} from './services/expense'
import { getEnvConfig, saveEnvConfig } from './services/env-manager'
import {
  createFamily,
  getAllFamilies,
  deleteFamily,
  createMember,
  getMembersByFamily,
  deleteMember,
  getAllMembers,
  ensureDefaults
} from './services/family'
import { recognizeReceipt } from './services/ocr'
import fs from 'fs'
import xlsx from 'node-xlsx'
import { generateBudgetTemplate, parseBudgetExcel, parseExpenseExcel } from './services/excel'

require('dotenv').config()

type ImportJobStatus = 'processing' | 'success' | 'failed' | 'canceled'

type ImportJob = {
  importId: number
  status: ImportJobStatus
  total: number
  processed: number
  success: number
  failed: number
  skipped: number
  startedAt: number
  fileName?: string
  errorMessage?: string
  canceled?: boolean
}

const importJobs = new Map<number, ImportJob>()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Handle permission requests
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media'] // Allow microphone/camera
    if (allowedPermissions.includes(permission)) {
      callback(true) // Approve permission request
    } else {
      callback(false) // Deny
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize database
  try {
    initDb()
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

// Basic IPC handlers
ipcMain.handle('ping', () => 'pong')

ipcMain.handle('transcribe-audio', async (_, buffer) => {
  const result = await startVoiceRecognition(buffer)
  return result.text
})

ipcMain.handle('parse-expense', async (_, text, _context) => {
  return parseExpense(text)
})

ipcMain.handle('recognize-image', async (_, buffer) => {
  return recognizeReceipt(buffer)
})

// iFlytek Connection Test
ipcMain.handle('test-iflytek-connection', async () => {
  return await testConnection()
})

ipcMain.handle('check-llm-connection', async () => {
  return await checkConnection()
})

ipcMain.handle('create-expense', async (_, data) => {
  return createExpense(data)
})

ipcMain.handle('get-expenses-by-date-range', async (_, startDate, endDate) => {
  return getExpensesByDateRange(startDate, endDate)
})

ipcMain.handle('get-expense-by-id', async (_, id) => {
  return getExpenseById(id)
})

ipcMain.handle('update-expense', async (_, id, data) => {
  return updateExpense(id, data)
})

ipcMain.handle('delete-expense', async (_, id) => {
  return deleteExpense(id)
})

ipcMain.handle('get-all-categories', async () => {
  return getAllCategories()
})

ipcMain.handle('get-statistics-by-date-range', async (_, startDate, endDate) => {
  return getStatisticsByDateRange(startDate, endDate)
})

ipcMain.handle('get-daily-statistics', async (_, startDate, endDate) => {
  return getDailyStatistics(startDate, endDate)
})

ipcMain.handle('get-total-amount-by-date-range', async (_, startDate, endDate, memberId) => {
  return getTotalAmountByDateRange(startDate, endDate, memberId)
})

ipcMain.handle('get-monthly-statistics', async (_, year, month) => {
  return getMonthlyStatistics(year, month)
})

ipcMain.handle('get-recent-expenses', async (_, limit, memberId) => {
  return getRecentExpenses(limit, memberId)
})

ipcMain.handle('search-expenses', async (_, keyword) => {
  return searchExpenses(keyword)
})

ipcMain.handle('check-network-status', async () => {
  return await checkConnection()
})

ipcMain.handle('get-expense-composition', async (_, startDate, endDate, level, parentValue) => {
  return getExpenseComposition(startDate, endDate, level, parentValue)
})

ipcMain.handle('get-expense-trend', async (_, startDate, endDate, dimension, filter) => {
  return getExpenseTrend(startDate, endDate, dimension, filter)
})

ipcMain.handle('get-monthly-budgets', async (_, year, month) => {
  return getMonthlyBudgets(year, month)
})

ipcMain.handle('save-monthly-budget', async (_, budget) => {
  return saveMonthlyBudget(budget)
})

ipcMain.handle('delete-monthly-budget', async (_, id) => {
  return deleteMonthlyBudget(id)
})

ipcMain.handle('get-year-goals', async (_, year, memberId) => {
  return getYearGoals(year, memberId)
})

ipcMain.handle('save-year-goal', async (_, goal) => {
  return saveYearGoal(goal)
})

ipcMain.handle('delete-year-goal', async (_, id, year, memberId) => {
  return deleteYearGoal(id, year, memberId)
})

ipcMain.handle('get-goal-comparison', async (_, year, startDate, endDate, memberId) => {
  return getGoalComparison(year, startDate, endDate, memberId)
})

ipcMain.handle('clear-all-data', async () => {
  return clearAllData()
})

ipcMain.handle('get-expense-structure', async () => {
  return getExpenseStructure()
})

ipcMain.handle('add-expense-hierarchy-item', async (_, project, category, subCategory) => {
  return addExpenseHierarchyItem(project, category, subCategory)
})

ipcMain.handle('get-all-expense-types', async () => {
  return getAllExpenseTypes()
})

ipcMain.handle('add-expense-type', async (_, name) => {
  return addExpenseType(name)
})

ipcMain.handle('update-expense-type', async (_, id, name) => {
  return updateExpenseType(id, name)
})

ipcMain.handle('toggle-expense-type', async (_, id, isActive) => {
  return toggleExpenseType(id, isActive)
})

// Env Config
ipcMain.handle('get-env-config', async () => {
  return getEnvConfig()
})

ipcMain.handle('save-env-config', async (_, config) => {
  return saveEnvConfig(config)
})

// 下载模板
ipcMain.handle('download-template', async () => {
  const result = await dialog.showSaveDialog({
    title: '下载 Excel 模板',
    defaultPath: '记账模板.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  })

  if (result.canceled || !result.filePath) return

  const data = [
    ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注'], // 表头
    ['爸爸', '餐饮', '一日三餐', '午餐', '2025-01-14', 35.5, '牛肉面'], // 示例数据
    ['妈妈', '交通', '公共交通', '地铁', '2025-01-14', 5.0, '上班通勤']
  ]
  const buffer = xlsx.build([{ name: '模板', data: data, options: {} }])
  fs.writeFileSync(result.filePath, buffer)
  return true
})

// 导入 Excel
ipcMain.handle('import-excel', async (event, payload, maybeFileName) => {
  try {
    const buffer = payload && payload.buffer ? payload.buffer : payload
    const fileName = (payload && payload.fileName ? payload.fileName : maybeFileName) as string | undefined

    const toNodeBuffer = (input: any) => {
      if (!input) return null
      if (Buffer.isBuffer(input)) return input
      if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input))
      if (ArrayBuffer.isView(input)) return Buffer.from(input as Uint8Array)
      return null
    }

    const nodeBuf = toNodeBuffer(buffer)
    if (!nodeBuf) throw new Error('导入数据格式错误：未收到有效的文件内容')
    if (nodeBuf.length === 0) throw new Error('Excel 文件为空或格式错误')
    if (nodeBuf.length > 30 * 1024 * 1024) throw new Error('Excel 文件过大（>30MB），请拆分后再导入')

    const startedAt = Date.now()
    
    // Ensure at least one family exists for auto-created members
    let families = getAllFamilies()
    let defaultFamilyId = 0
    if (families.length === 0) {
        defaultFamilyId = createFamily('默认家庭组')
    } else {
        defaultFamilyId = families[0].id!
    }

    let members = getAllMembers()

    const importId = addImportHistory(fileName || `Import_${new Date().toISOString()}`, 'expense', 0)
    const logPath = join(app.getPath('userData'), 'import-expense.log')
    const log = (level: 'info' | 'warn' | 'error', obj: any) => {
      const line = JSON.stringify({ ts: new Date().toISOString(), level, importId, ...obj })
      try {
        fs.appendFileSync(logPath, `${line}\n`)
      } catch {
      }
      if (level === 'error') console.error(line)
      else console.log(line)
    }

    updateImportHistoryProgress(importId, {
      status: 'processing',
      total_rows: 0,
      processed_rows: 0,
      record_count: 0,
      failed_count: 0,
      skipped_count: 0,
      file_size_bytes: nodeBuf.length,
      error_message: null,
      finished_at: null,
    })

    let job: ImportJob = {
      importId,
      status: 'processing',
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      startedAt,
      fileName,
    }
    importJobs.set(importId, job)

    const wc = event.sender
    wc.send('import-excel-progress', { ...job })

    const yieldNow = () => new Promise<void>((resolve) => setImmediate(resolve))
    const batchSize = 200

    setImmediate(async () => {
      let successCount = 0
      let failedCount = 0
      let skippedCount = 0
      let parsedErrors: any[] = []

      try {
        const arrayBuffer = nodeBuf.buffer.slice(
          nodeBuf.byteOffset,
          nodeBuf.byteOffset + nodeBuf.byteLength
        ) as ArrayBuffer
        const parsed = parseExpenseExcel(arrayBuffer)
        parsedErrors = parsed.errors
        failedCount = parsed.errors.length

        const total = parsed.rows.length + parsed.errors.length
        job.total = total
        job.failed = failedCount
        importJobs.set(importId, job)

        updateImportHistoryProgress(importId, {
          status: 'processing',
          total_rows: total,
          processed_rows: 0,
          record_count: 0,
          failed_count: failedCount,
          skipped_count: 0,
          error_message: parsed.errors.length ? `解析失败行数: ${parsed.errors.length}` : null,
          finished_at: null,
        })
        wc.send('import-excel-progress', { ...job })
        await yieldNow()

        const validRows = parsed.rows
        if (validRows.length === 0) {
          job.status = 'failed'
          job.errorMessage = parsed.errors.length ? '所有数据行均解析失败' : 'Excel 文件为空或无有效数据'
          updateImportHistoryProgress(importId, {
            status: 'failed',
            processed_rows: 0,
            total_rows: total,
            record_count: 0,
            failed_count: failedCount,
            skipped_count: 0,
            error_message: job.errorMessage,
            finished_at: new Date().toISOString(),
          })
          wc.send('import-excel-done', { ...job, errors: parsed.errors })
          return
        }

        const dates = validRows.map((r) => r.expense_date).sort()
        const minDate = dates[0]
        const maxDate = dates[dates.length - 1]

        const existing = getExpensesByDateRange(minDate, maxDate)
        const keyOf = (r: any) => {
          const amount = Number(r.amount)
          const category = (r.category || '').toString()
          const description = (r.description || '').toString()
          const project = (r.project || '').toString()
          const sub = (r.sub_category || '').toString()
          const memberId = r.member_id ?? ''
          return `${r.expense_date}|${amount}|${category}|${description}|${project}|${sub}|${memberId}`
        }
        const existingKeySet = new Set(existing.map(keyOf))

        if (parsed.errors.length > 0) {
          log('warn', { event: 'parse_errors', count: parsed.errors.length, sample: parsed.errors.slice(0, 10) })
        }

        for (let idx = 0; idx < validRows.length; idx++) {
          if (job.canceled) throw new Error('导入已取消')
          const row = validRows[idx]

          try {
            let memberId: number | undefined = undefined
            if (row.member_name) {
              const nameStr = row.member_name.trim()
              let member = members.find((m) => m.name === nameStr)
              if (!member) {
                const newId = createMember(nameStr, defaultFamilyId)
                member = { id: newId, name: nameStr, family_id: defaultFamilyId }
                members.push(member)
                log('info', { event: 'auto_create_member', name: nameStr, memberId: newId })
              }
              memberId = member.id
            }

            const candidate = {
              expense_date: row.expense_date,
              amount: row.amount,
              category: row.category,
              description: row.description,
              project: row.project || '',
              sub_category: row.sub_category || '',
              member_id: memberId,
            }
            const key = keyOf(candidate)
            if (existingKeySet.has(key)) {
              skippedCount++
            } else {
              createExpense({
                project: row.project,
                category: row.category,
                sub_category: row.sub_category,
                amount: row.amount,
                expense_date: row.expense_date,
                description: row.description,
                voice_text: '',
                member_id: memberId,
                import_id: importId,
              })
              existingKeySet.add(key)
              successCount++
            }
          } catch (e: any) {
            failedCount++
            log('error', { event: 'row_failed', message: e?.message || '写入失败', rowIndex: idx + 2 })
          } finally {
            job.processed++
          }

          if (job.processed % batchSize === 0 || job.processed === validRows.length) {
            job.success = successCount
            job.failed = failedCount
            job.skipped = skippedCount
            importJobs.set(importId, job)
            updateImportHistoryProgress(importId, {
              status: 'processing',
              processed_rows: job.processed,
              total_rows: total,
              record_count: successCount,
              failed_count: failedCount,
              skipped_count: skippedCount,
              error_message: parsed.errors.length ? `解析失败行数: ${parsed.errors.length}` : null,
              finished_at: null,
            })
            wc.send('import-excel-progress', { ...job })
            await yieldNow()
          }
        }

        job.status = successCount > 0 ? 'success' : 'failed'
        job.success = successCount
        job.failed = failedCount
        job.skipped = skippedCount
        importJobs.set(importId, job)

        updateImportHistoryProgress(importId, {
          status: job.status === 'success' ? 'success' : 'failed',
          processed_rows: job.processed,
          total_rows: total,
          record_count: successCount,
          failed_count: failedCount,
          skipped_count: skippedCount,
          error_message:
            job.status === 'success'
              ? (parsed.errors.length ? `解析失败行数: ${parsed.errors.length}` : null)
              : (parsed.errors.length ? '导入失败：有效行均写入失败' : '导入失败'),
          finished_at: new Date().toISOString(),
        })

        wc.send('import-excel-done', { ...job, errors: parsed.errors })
      } catch (e: any) {
        job.status = 'failed'
        job.errorMessage = e?.message || '导入失败'

        const shouldRollback = job.errorMessage === '导入已取消'
        if (shouldRollback) {
          rollbackImportExpenses(importId)
          successCount = 0
          skippedCount = 0
        }
        updateImportHistoryProgress(importId, {
          status: shouldRollback ? 'canceled' : 'failed',
          processed_rows: job.processed,
          total_rows: job.total,
          record_count: shouldRollback ? 0 : successCount,
          failed_count: failedCount,
          skipped_count: shouldRollback ? 0 : skippedCount,
          error_message: job.errorMessage,
          finished_at: new Date().toISOString(),
        })
        wc.send('import-excel-done', { ...job, errors: parsedErrors })
      } finally {
        importJobs.delete(importId)
      }
    })

    return { importId, status: 'processing', total: 0, success: 0, failed: 0, skipped: 0, errors: [] }
  } catch (error: any) {
    throw new Error(`解析 Excel 失败: ${error.message}`)
  }
})

ipcMain.handle('get-import-job-status', async (_, importId: number) => {
  return importJobs.get(importId) || null
})

ipcMain.handle('cancel-import-job', async (_, importId: number) => {
  const job = importJobs.get(importId)
  if (!job) return false
  job.canceled = true
  return true
})

// 下载预算模板
ipcMain.handle('download-budget-template', async () => {
  const result = await dialog.showSaveDialog({
    title: '下载预算目标模板',
    defaultPath: '预算目标模板.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  })

  if (result.canceled || !result.filePath) return

  const buffer = generateBudgetTemplate()
  fs.writeFileSync(result.filePath, buffer)
  return true
})

// 导入预算目标 (使用新模板)
ipcMain.handle('import-budget-goals', async (_, buffer, year, memberId) => {
  try {
    const rows = parseBudgetExcel(buffer)
    let successCount = 0
    let failedCount = 0

    for (const row of rows) {
        try {
            saveYearGoal({
                year: year,
                project: row.project,
                category: row.category,
                sub_category: row.sub_category,
                goal_amount: row.amount,
                expense_type: row.expense_type,
                member_id: memberId
            })
            successCount++
        } catch (e) {
            console.error('Import budget row failed:', e)
            failedCount++
        }
    }
    return { success: successCount, failed: failedCount }
  } catch (error: any) {
    throw new Error(error.message)
  }
})

ipcMain.handle('get-import-history', async () => {
    return getImportHistory()
})

ipcMain.handle('delete-import-record', async (_, id) => {
    return deleteImportRecord(id)
})

ipcMain.handle('clean-duplicate-data', async () => {
    return cleanDuplicateExpenses()
})

// Family Ledger Handlers
ipcMain.handle('create-family', async (_, name) => {
  return createFamily(name)
})

ipcMain.handle('get-all-families', async () => {
  return getAllFamilies()
})

ipcMain.handle('delete-family', async (_, id) => {
  return deleteFamily(id)
})

ipcMain.handle('create-member', async (_, name, familyId, avatar) => {
  return createMember(name, familyId, avatar)
})

ipcMain.handle('get-members-by-family', async (_, familyId) => {
  return getMembersByFamily(familyId)
})

ipcMain.handle('get-all-members', async () => {
  return getAllMembers()
})

ipcMain.handle('delete-member', async (_, id) => {
  return deleteMember(id)
})

ipcMain.handle('ensure-defaults', async () => {
  ensureDefaults()
})
