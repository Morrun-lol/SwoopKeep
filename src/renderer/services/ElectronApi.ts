
import { ExpenseApi } from './ApiInterface'

export class ElectronApi implements ExpenseApi {
  transcribeAudio(buffer: ArrayBuffer): Promise<string> {
    return window.electron.ipcRenderer.invoke('transcribe-audio', buffer)
  }
  parseExpense(text: string, context?: any): Promise<any> {
    return window.electron.ipcRenderer.invoke('parse-expense', text, context)
  }
  checkLLMConnection(): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('check-llm-connection')
  }
  testiFlytekConnection(): Promise<{ success: boolean; message: string; logs: string[] }> {
    return window.electron.ipcRenderer.invoke('test-iflytek-connection')
  }
  createExpense(data: any): Promise<number> {
    return window.electron.ipcRenderer.invoke('create-expense', data)
  }
  getExpensesByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-expenses-by-date-range', startDate, endDate)
  }
  getExpenseById(id: number): Promise<any | undefined> {
    return window.electron.ipcRenderer.invoke('get-expense-by-id', id)
  }
  updateExpense(id: number, data: any): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('update-expense', id, data)
  }
  deleteExpense(id: number): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('delete-expense', id)
  }
  getAllCategories(): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-all-categories')
  }
  getStatisticsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-statistics-by-date-range', startDate, endDate)
  }
  getDailyStatistics(startDate: string, endDate: string): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-daily-statistics', startDate, endDate)
  }
  getTotalAmountByDateRange(startDate: string, endDate: string, memberId?: number): Promise<{ total_amount: number, total_count: number }> {
    return window.electron.ipcRenderer.invoke('get-total-amount-by-date-range', startDate, endDate, memberId)
  }
  getMonthlyStatistics(year: number, month: number): Promise<any> {
    return window.electron.ipcRenderer.invoke('get-monthly-statistics', year, month)
  }
  getRecentExpenses(limit?: number, memberId?: number): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-recent-expenses', limit, memberId)
  }
  searchExpenses(keyword: string): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('search-expenses', keyword)
  }
  checkNetworkStatus(): Promise<{ baidu: boolean; google: boolean; googleApi: boolean; openai: boolean; gemini: boolean; proxy: string; error?: string }> {
    return window.electron.ipcRenderer.invoke('check-network-status')
  }
  downloadTemplate(): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('download-template')
  }
  downloadBudgetTemplate(): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('download-budget-template')
  }
  importExcel(buffer: ArrayBuffer, fileName?: string): Promise<{ success: number, failed: number, skipped?: number, importId?: number, errors?: { rowNumber: number, message: string }[] }> {
    return window.electron.ipcRenderer.invoke('import-excel', buffer, fileName)
  }
  getExpenseComposition(startDate: string, endDate: string, level?: string, parentValue?: string): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-expense-composition', startDate, endDate, level, parentValue)
  }
  getExpenseTrend(startDate: string, endDate: string, dimension?: string, filter?: any): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-expense-trend', startDate, endDate, dimension, filter)
  }
  getYearGoals(year: number, memberId?: number): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-year-goals', year, memberId)
  }
  saveYearGoal(goal: any): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('save-year-goal', goal)
  }
  getGoalComparison(year: number, startDate?: string, endDate?: string, memberId?: number): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-goal-comparison', year, startDate, endDate, memberId)
  }
  clearAllData(): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('clear-all-data')
  }
  getExpenseStructure(): Promise<{ project: string; category: string; sub_category: string }[]> {
    return window.electron.ipcRenderer.invoke('get-expense-structure')
  }
  recognizeImage(buffer: ArrayBuffer): Promise<{ text: string; provider: string }> {
    return window.electron.ipcRenderer.invoke('recognize-image', buffer)
  }
  importBudgetGoals(buffer: ArrayBuffer, year: number, memberId?: number): Promise<{ success: number; failed: number }> {
    return window.electron.ipcRenderer.invoke('import-budget-goals', buffer, year, memberId)
  }
  getImportHistory(): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-import-history')
  }
  deleteImportRecord(id: number): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('delete-import-record', id)
  }
  cleanDuplicateData(): Promise<number> {
    return window.electron.ipcRenderer.invoke('clean-duplicate-data')
  }
  deleteYearGoal(id: number, year: number, memberId?: number): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('delete-year-goal', id, year, memberId)
  }
  addExpenseHierarchyItem(project: string, category: string, subCategory: string): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('add-expense-hierarchy-item', project, category, subCategory)
  }
  getAllExpenseTypes(): Promise<{ id: number; name: string; is_active: number }[]> {
    return window.electron.ipcRenderer.invoke('get-all-expense-types')
  }
  addExpenseType(name: string): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('add-expense-type', name)
  }
  updateExpenseType(id: number, name: string): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('update-expense-type', id, name)
  }
  toggleExpenseType(id: number, isActive: boolean): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('toggle-expense-type', id, isActive)
  }

  getMonthlyBudgets(year: number, month: number): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-monthly-budgets', year, month)
  }

  saveMonthlyBudget(budget: any): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('save-monthly-budget', budget)
  }

  deleteMonthlyBudget(id: number): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('delete-monthly-budget', id)
  }

  ensureDefaults(): Promise<void> {
    return window.electron.ipcRenderer.invoke('ensure-defaults')
  }
  createFamily(name: string): Promise<number> {
    return window.electron.ipcRenderer.invoke('create-family', name)
  }
  getAllFamilies(): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-all-families')
  }
  deleteFamily(id: number): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('delete-family', id)
  }
  createMember(name: string, familyId: number, avatar?: string): Promise<number> {
    return window.electron.ipcRenderer.invoke('create-member', name, familyId, avatar)
  }
  getMembersByFamily(familyId: number): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-members-by-family', familyId)
  }
  getAllMembers(): Promise<any[]> {
    return window.electron.ipcRenderer.invoke('get-all-members')
  }
  deleteMember(id: number): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('delete-member', id)
  }
}
