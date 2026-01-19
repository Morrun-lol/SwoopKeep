import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  transcribeAudio: (buffer: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio', buffer),
  parseExpense: (text: string) => ipcRenderer.invoke('parse-expense', text),
  checkLLMConnection: () => ipcRenderer.invoke('check-llm-connection'),
  testiFlytekConnection: () => ipcRenderer.invoke('test-iflytek-connection'),
  createExpense: (data: any) => ipcRenderer.invoke('create-expense', data),
  getExpensesByDateRange: (startDate: string, endDate: string) => ipcRenderer.invoke('get-expenses-by-date-range', startDate, endDate),
  getExpenseById: (id: number) => ipcRenderer.invoke('get-expense-by-id', id),
  updateExpense: (id: number, data: any) => ipcRenderer.invoke('update-expense', id, data),
  deleteExpense: (id: number) => ipcRenderer.invoke('delete-expense', id),
  getAllCategories: () => ipcRenderer.invoke('get-all-categories'),
  getStatisticsByDateRange: (startDate: string, endDate: string) => ipcRenderer.invoke('get-statistics-by-date-range', startDate, endDate),
  getDailyStatistics: (startDate: string, endDate: string) => ipcRenderer.invoke('get-daily-statistics', startDate, endDate),
  getTotalAmountByDateRange: (startDate: string, endDate: string, memberId?: number) => ipcRenderer.invoke('get-total-amount-by-date-range', startDate, endDate, memberId),
  getMonthlyStatistics: (year: number, month: number) => ipcRenderer.invoke('get-monthly-statistics', year, month),
  getRecentExpenses: (limit?: number, memberId?: number) => ipcRenderer.invoke('get-recent-expenses', limit, memberId),
  searchExpenses: (keyword: string) => ipcRenderer.invoke('search-expenses', keyword),
  checkNetworkStatus: () => ipcRenderer.invoke('check-network-status'),
  downloadTemplate: () => ipcRenderer.invoke('download-template'),
  downloadBudgetTemplate: () => ipcRenderer.invoke('download-budget-template'),
  importExcel: (buffer: ArrayBuffer) => ipcRenderer.invoke('import-excel', buffer),
  getExpenseComposition: (startDate: string, endDate: string, level?: string, parentValue?: string) => ipcRenderer.invoke('get-expense-composition', startDate, endDate, level, parentValue),
  getExpenseTrend: (startDate: string, endDate: string, dimension?: string, filter?: any) => ipcRenderer.invoke('get-expense-trend', startDate, endDate, dimension, filter),
  getYearGoals: (year: number, memberId?: number) => ipcRenderer.invoke('get-year-goals', year, memberId),
  saveYearGoal: (goal: any) => ipcRenderer.invoke('save-year-goal', goal),
  getGoalComparison: (year: number, startDate?: string, endDate?: string, memberId?: number) => ipcRenderer.invoke('get-goal-comparison', year, startDate, endDate, memberId),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  getExpenseStructure: () => ipcRenderer.invoke('get-expense-structure'),
  recognizeImage: (buffer: ArrayBuffer) => ipcRenderer.invoke('recognize-image', buffer),
  importBudgetGoals: (buffer: ArrayBuffer, year: number, memberId?: number) => ipcRenderer.invoke('import-budget-goals', buffer, year, memberId),
  getImportHistory: () => ipcRenderer.invoke('get-import-history'),
  deleteImportRecord: (id: number) => ipcRenderer.invoke('delete-import-record', id),
  cleanDuplicateData: () => ipcRenderer.invoke('clean-duplicate-data'),
  deleteYearGoal: (id: number, year: number, memberId?: number) => ipcRenderer.invoke('delete-year-goal', id, year, memberId),
  addExpenseHierarchyItem: (project: string, category: string, subCategory: string) => ipcRenderer.invoke('add-expense-hierarchy-item', project, category, subCategory),
  getAllExpenseTypes: () => ipcRenderer.invoke('get-all-expense-types'),
  addExpenseType: (name: string) => ipcRenderer.invoke('add-expense-type', name),
  updateExpenseType: (id: number, name: string) => ipcRenderer.invoke('update-expense-type', id, name),
  toggleExpenseType: (id: number, isActive: boolean) => ipcRenderer.invoke('toggle-expense-type', id, isActive),
  
  // Env Config
  getEnvConfig: () => ipcRenderer.invoke('get-env-config'),
  saveEnvConfig: (config: any) => ipcRenderer.invoke('save-env-config', config),

  // Family Ledger
  createFamily: (name: string) => ipcRenderer.invoke('create-family', name),
  getAllFamilies: () => ipcRenderer.invoke('get-all-families'),
  deleteFamily: (id: number) => ipcRenderer.invoke('delete-family', id),
  
  createMember: (name: string, familyId: number, avatar?: string) => ipcRenderer.invoke('create-member', name, familyId, avatar),
  getMembersByFamily: (familyId: number) => ipcRenderer.invoke('get-members-by-family', familyId),
  getAllMembers: () => ipcRenderer.invoke('get-all-members'),
  deleteMember: (id: number) => ipcRenderer.invoke('delete-member', id)
}

// Use `contextBridge` APIs to expose IPC to the renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
        on: (channel: string, func: (...args: any[]) => void) => {
          const subscription = (_event: any, ...args: any[]) => func(...args)
          ipcRenderer.on(channel, subscription)
          return () => ipcRenderer.removeListener(channel, subscription)
        },
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electron
  // @ts-ignore (define in dts)
  window.api = api
}
