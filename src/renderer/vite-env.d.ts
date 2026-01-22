/// <reference types="vite/client" />

interface Window {
  electron: {
    ipcRenderer: {
      send(channel: string, ...args: any[]): void
      on(channel: string, func: (...args: any[]) => void): () => void
      invoke(channel: string, ...args: any[]): Promise<any>
    }
  }
  api: {
    transcribeAudio(buffer: ArrayBuffer): Promise<string>
    parseExpense(text: string, context?: any): Promise<any>
    checkLLMConnection(): Promise<boolean>
    testiFlytekConnection(): Promise<{ success: boolean; message: string; logs: string[] }>
    createExpense(data: any): Promise<number>
    getExpensesByDateRange(startDate: string, endDate: string): Promise<any[]>
    getExpenseById(id: number): Promise<any | undefined>
    updateExpense(id: number, data: any): Promise<boolean>
    deleteExpense(id: number): Promise<boolean>
    getAllCategories(): Promise<any[]>
    getStatisticsByDateRange(startDate: string, endDate: string): Promise<any[]>
    getDailyStatistics(startDate: string, endDate: string): Promise<any[]>
    getTotalAmountByDateRange(startDate: string, endDate: string, memberId?: number): Promise<{ total_amount: number, total_count: number }>
    getMonthlyStatistics(year: number, month: number): Promise<any>
    getRecentExpenses(limit?: number, memberId?: number): Promise<any[]>
    searchExpenses(keyword: string): Promise<any[]>
    checkNetworkStatus(): Promise<{
      baidu: boolean;
      google: boolean;
      googleApi: boolean;
      openai: boolean;
      gemini: boolean;
      proxy: string;
      error?: string;
    }>
    downloadTemplate(): Promise<boolean>
    downloadBudgetTemplate(): Promise<boolean>
    importExcel(buffer: ArrayBuffer, fileName?: string): Promise<{ importId?: number, status?: string, total?: number, success: number, failed: number, skipped?: number, errors?: { rowNumber: number, message: string }[] }>
    getImportJobStatus(importId: number): Promise<any>
    cancelImportJob(importId: number): Promise<boolean>
    onImportExcelProgress(func: (payload: any) => void): () => void
    onImportExcelDone(func: (payload: any) => void): () => void
    getExpenseComposition(startDate: string, endDate: string, level?: string, parentValue?: string): Promise<any[]>
    getExpenseTrend(startDate: string, endDate: string, dimension?: string, filter?: any): Promise<any[]>
    getYearGoals(year: number, memberId?: number): Promise<{
        id: number
        year: number
        project: string
        category: string
        sub_category: string
        goal_amount: number
        expense_type: string
    }[]>
    saveYearGoal(goal: any): Promise<any[]>
    getGoalComparison(year: number, startDate?: string, endDate?: string, memberId?: number): Promise<any[]>
    clearAllData(): Promise<boolean>
    getExpenseStructure(): Promise<{ project: string, category: string, sub_category: string }[]>
    recognizeImage(buffer: ArrayBuffer): Promise<{ text: string, provider: string }>
    importBudgetGoals(buffer: ArrayBuffer, year: number, memberId?: number): Promise<{ success: number, failed: number }>
    getImportHistory(): Promise<any[]>
    deleteImportRecord(id: number): Promise<boolean>
    cleanDuplicateData(): Promise<number>
    deleteYearGoal(id: number, year: number, memberId?: number): Promise<any[]>
    addExpenseHierarchyItem(project: string, category: string, subCategory: string): Promise<boolean>
    
    // Expense Types
    getAllExpenseTypes(): Promise<{ id: number; name: string; is_active: number }[]>
    addExpenseType(name: string): Promise<boolean>
    updateExpenseType(id: number, name: string): Promise<boolean>
    toggleExpenseType(id: number, isActive: boolean): Promise<boolean>

    // Family Ledger
    createFamily(name: string): Promise<number>
    getAllFamilies(): Promise<any[]>
    deleteFamily(id: number): Promise<boolean>
    
    createMember(name: string, familyId: number, avatar?: string): Promise<number>
    getMembersByFamily(familyId: number): Promise<any[]>
    getAllMembers(): Promise<any[]>
    deleteMember(id: number): Promise<boolean>

    // Monthly Budgets
    getMonthlyBudgets(year: number, month: number): Promise<any[]>
    saveMonthlyBudget(budget: any): Promise<boolean>
    deleteMonthlyBudget(id: number): Promise<boolean>

    // Defaults
    ensureDefaults(): Promise<void>
  }
}
