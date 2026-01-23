import '@testing-library/jest-dom/vitest'

;(window as any).api = (window as any).api || {}
;(window as any).api.getExpensesByDateRange = (window as any).api.getExpensesByDateRange || (async () => [])
