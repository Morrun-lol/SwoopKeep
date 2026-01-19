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
  addExpenseHierarchyItem,
  getExpenseStructure,
  getAllExpenseTypes,
  addExpenseType,
  updateExpenseType,
  toggleExpenseType
} from './services/expense'
import { getEnvConfig, saveEnvConfig } from './services/env-manager'
import {
  createFamily,
  getAllFamilies,
  deleteFamily,
  createMember,
  getMembersByFamily,
  deleteMember,
  getAllMembers
} from './services/family'
import { recognizeReceipt } from './services/ocr'
import fs from 'fs'
import { generateBudgetTemplate, parseBudgetExcel } from './services/excel'

require('dotenv').config()

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

ipcMain.handle('parse-expense', async (_, text) => {
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
  // @ts-ignore
  const buffer = xlsx.build([{ name: '模板', data: data, options: {} }])
  fs.writeFileSync(result.filePath, buffer)
  return true
})

// 导入 Excel
ipcMain.handle('import-excel', async (_, buffer) => {
  try {
    // @ts-ignore
    const sheets = xlsx.parse(Buffer.from(buffer))
    const sheet = sheets[0] // 读取第一个 sheet
    const data = sheet.data as any[][]

    if (data.length < 2) throw new Error('Excel 文件为空或格式错误')

    // 校验表头
    const header = data[0]
    const requiredHeader = ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注']
    if (JSON.stringify(header.slice(0, 7)) !== JSON.stringify(requiredHeader)) {
      // 兼容旧模板（无费用归属）
      const oldHeader = ['项目', '分类', '子分类', '日期', '金额', '备注']
      if (JSON.stringify(header.slice(0, 6)) !== JSON.stringify(oldHeader)) {
         throw new Error(`表头格式错误。请下载最新模板，确保表头包含：${requiredHeader.join(', ')}`)
      }
    }

    let successCount = 0
    let failedCount = 0
    
    // Ensure at least one family exists for auto-created members
    let families = getAllFamilies()
    let defaultFamilyId = 0
    if (families.length === 0) {
        defaultFamilyId = createFamily('默认家庭组')
    } else {
        defaultFamilyId = families[0].id!
    }

    // Get all members for matching
    let members = getAllMembers()
    console.log('[Import] Starting import. Members:', members.length)
    
    // We will update frontend to pass filename. For now use timestamp.
    const importId = addImportHistory('Batch Import (Expenses)', 'expense', 0) // Placeholder count
    console.log('[Import] History ID:', importId)

    // 从第二行开始遍历数据
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (row.length === 0) continue

      try {
        let memberName, project, category, subCategory, rawDate, amount, note
        
        // 判断是新模板还是旧模板
        if (row.length >= 7 || header[0] === '费用归属') {
            [memberName, project, category, subCategory, rawDate, amount, note] = row
        } else {
            [project, category, subCategory, rawDate, amount, note] = row
        }
        
        // 查找成员ID，如果不存在则自动创建
        let memberId = null
        if (memberName) {
            const nameStr = String(memberName).trim()
            if (nameStr) {
                let member = members.find(m => m.name === nameStr)
                if (!member) {
                    // Auto-create member
                    const newId = createMember(nameStr, defaultFamilyId)
                    member = { id: newId, name: nameStr, family_id: defaultFamilyId }
                    members.push(member) // Update local cache
                    console.log(`[Import] Auto-created member: ${nameStr}`)
                }
                memberId = member.id
            }
        }
        
        // 简单的数据校验
        if (!amount || isNaN(Number(amount))) {
          failedCount++
          continue
        }

        // 处理日期 (Excel 日期可能是数字或字符串)
        let dateStr = ''
        if (typeof rawDate === 'number') {
          // Excel 日期转 JS 日期
          const date = new Date((rawDate - 25569) * 86400 * 1000)
          dateStr = date.toISOString().split('T')[0]
        } else {
           dateStr = String(rawDate)
        }

        // 构造存入数据库的对象
        const finalCategory = category || '其他'
        const finalDesc = note || ''

        // 自动去重逻辑：检查是否已存在完全相同的记录
        const existing = getExpensesByDateRange(dateStr, dateStr).find(record => 
          record.amount === Number(amount) && 
          record.category === String(finalCategory) &&
          (record.description || '') === finalDesc &&
          (record.project || '') === (project ? String(project) : '') &&
          (record.sub_category || '') === (subCategory ? String(subCategory) : '') &&
          record.member_id === memberId
        )

        if (existing) {
          // console.log(`Duplicate record found, skipping: ${dateStr} ${amount}`)
          // We count it as skipped but don't throw error
          // To implement 'skipped' count properly we need to change return type, 
          // but for now let's just not insert it.
          continue
        }
        
        createExpense({
          project: project ? String(project) : undefined,
          category: String(finalCategory),
          sub_category: subCategory ? String(subCategory) : undefined,
          amount: Number(amount),
          expense_date: dateStr,
          description: finalDesc,
           voice_text: '',
           member_id: memberId || undefined,
           import_id: importId
         })
        successCount++
      } catch (e) {
        console.error(`Row ${i + 1} import failed:`, e)
        failedCount++
      }
    }
    
    // Update the actual count
    updateImportHistoryCount(importId, successCount)
    
    return { success: successCount, failed: failedCount, importId }
  } catch (error: any) {
    throw new Error(`解析 Excel 失败: ${error.message}`)
  }
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
