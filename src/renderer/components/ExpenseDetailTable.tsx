import { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns'
import { ChevronDown, ChevronUp, Loader2, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'

interface ExpenseDetailTableProps {
  // Option 1: Filter object (Legacy support or for complex filters)
  filter?: {
    date?: string
    dimension: 'day' | 'week' | 'month' | 'quarter' | 'year'
    category?: string | null
  } | null
  
  // Option 2: Explicit range (New standard)
  startDate?: string
  endDate?: string
  title?: string
  category?: string | null
  onClear?: () => void
}

interface Expense {
  id: number
  amount: number
  expense_date: string
  category: string
  sub_category?: string
  project?: string
  description: string
  payment_method?: string
}

export default function ExpenseDetailTable({ filter, startDate, endDate, title, category, onClear }: ExpenseDetailTableProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]) // Current page expenses
  const [allFilteredExpenses, setAllFilteredExpenses] = useState<Expense[]>([]) // All fetched expenses for export
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 10 // Requirement: Default 10 records per page
  const [totalCount, setTotalCount] = useState(0)
  
  // Sorting
  const [sortField, setSortField] = useState<'amount' | 'expense_date' | 'category'>('amount') // Default sort by amount as requested
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Expanded Rows
  const [expandedRows, setExpandedRows] = useState<number[]>([])

  // Reset sort and page when filter changes (e.g. user clicks a specific day)
  useEffect(() => {
    if (filter && filter.date) {
        setSortField('amount')
        setSortOrder('desc')
    }
    // Always reset page when main filter props change to avoid empty views
    setPage(1)
  }, [filter, startDate, endDate, category]) // Depend on filter object reference or specific fields if stable

  const getDateRange = (dateStr: string, dimension: string) => {
    // Safer parsing for YYYY-MM-DD to avoid timezone shifts
    let date: Date
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = dateStr.split('-').map(Number)
        date = new Date(y, m - 1, d) // Construct local date at 00:00:00
    } else {
        date = new Date(dateStr)
    }

    switch (dimension) {
      case 'day':
        // For 'day', we want the specific date string exactly
        // If we use startOfDay/endOfDay, it returns local time boundaries.
        // format('yyyy-MM-dd') will return the date string.
        // It's safer to just return the dateStr itself if it's already YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return { start: dateStr, end: dateStr }
        }
        return { start: format(startOfDay(date), 'yyyy-MM-dd'), end: format(endOfDay(date), 'yyyy-MM-dd') }
      case 'week':
        return { start: format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') }
      case 'month':
        return { start: format(startOfMonth(date), 'yyyy-MM-dd'), end: format(endOfMonth(date), 'yyyy-MM-dd') }
      case 'quarter':
        return { start: format(startOfQuarter(date), 'yyyy-MM-dd'), end: format(endOfQuarter(date), 'yyyy-MM-dd') }
      case 'year':
        return { start: format(startOfYear(date), 'yyyy-MM-dd'), end: format(endOfYear(date), 'yyyy-MM-dd') }
      default:
        return { start: format(startOfDay(date), 'yyyy-MM-dd'), end: format(endOfDay(date), 'yyyy-MM-dd') }
    }
  }

  const fetchExpenses = useCallback(async () => {
    // Determine effective start/end and category
    let effectiveStart = startDate
    let effectiveEnd = endDate
    let effectiveCategory = category
    let displayTitle = title

    if (filter && filter.date) {
        const range = getDateRange(filter.date, filter.dimension)
        effectiveStart = range.start
        effectiveEnd = range.end
        effectiveCategory = filter.category
        if (!displayTitle) {
             displayTitle = `${filter.date} (${filter.dimension === 'day' ? '日' : filter.dimension === 'week' ? '周' : filter.dimension === 'month' ? '月' : '季'})`
        }
    }

    if (!effectiveStart || !effectiveEnd) {
        setExpenses([])
        return
    }

    setLoading(true)
    setError(null)
    
    try {
        let data = await window.api.getExpensesByDateRange(effectiveStart, effectiveEnd)
        
        // Filter by category if present
        if (effectiveCategory) {
            data = data.filter((e: any) => e.category === effectiveCategory)
        }
        
        // Sort
        data.sort((a: any, b: any) => {
            const valA = a[sortField]
            const valB = b[sortField]
            
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1
            return 0
        })
        
        setTotalCount(data.length)
        setAllFilteredExpenses(data)
        
        // Pagination
        const startIdx = (page - 1) * pageSize
        const pagedData = data.slice(startIdx, startIdx + pageSize)
        
        setExpenses(pagedData)
        
    } catch (err) {
        console.error(err)
        setError('加载数据失败，请重试')
    } finally {
        setLoading(false)
    }
  }, [filter, startDate, endDate, category, page, sortField, sortOrder])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const toggleSort = (field: 'amount' | 'expense_date' | 'category') => {
    if (sortField === field) {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
        setSortField(field)
        setSortOrder('desc')
    }
  }

  const handleExport = () => {
    if (allFilteredExpenses.length === 0) return

    // CSV Header
    const headers = ['ID', '日期', '金额', '类别', '子类别', '项目', '说明', '支付方式']
    
    // CSV Rows
    const rows = allFilteredExpenses.map(e => [
        e.id,
        format(new Date(e.expense_date), 'yyyy-MM-dd HH:mm:ss'),
        e.amount.toFixed(2),
        e.category,
        e.sub_category || '',
        e.project || '',
        `"${(e.description || '').replace(/"/g, '""')}"`, // Escape quotes
        e.payment_method || ''
    ])
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Create blob and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }) // Add BOM for Excel
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `expense_export_${format(new Date(), 'yyyyMMddHHmm')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleRow = (id: number) => {
    setExpandedRows(prev => 
        prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    )
  }

  // Calculate display title for render if not provided via props/logic above
  // (Re-calculated for render consistency)
  let renderTitle = title
  let renderCategory = category
  if (filter && filter.date) {
      if (!renderTitle) {
          // Format requirement: "当前查看：YYYY年MM月DD日"
          if (filter.dimension === 'day') {
              const d = new Date(filter.date)
              renderTitle = `当前查看：${format(d, 'yyyy年MM月dd日')}`
          } else {
              renderTitle = `${filter.date} (${filter.dimension === 'week' ? '周' : filter.dimension === 'month' ? '月' : '季'})`
          }
      }
      if (!renderCategory) renderCategory = filter.category
  }
  if (!renderTitle && startDate && endDate) {
      renderTitle = `${startDate} 至 ${endDate}`
  }

  // If no valid configuration, don't render? Or render empty state?
  // Let's render if we have at least start/end
  if (!filter?.date && (!startDate || !endDate)) return null

  const isLinked = !!(filter && filter.date)

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden mt-6 ${isLinked ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-4">
            <div>
                <h3 className="font-bold text-gray-900">支出明细</h3>
                <div className="text-sm text-gray-500 mt-1">
                    {renderTitle}
                    {renderCategory && <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">{renderCategory}</span>}
                    {isLinked && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs whitespace-nowrap">
                        已联动筛选
                      </span>
                    )}
                </div>
            </div>
            {/* onClear && filter?.date && (
                <div 
                    className="text-xs text-gray-400 italic"
                >
                    点击趋势图空白处可返回
                </div>
            ) */}
        </div>
        
        <button
            onClick={handleExport}
            disabled={totalCount === 0}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
            导出 CSV
        </button>
      </div>

      <div className="relative">
          {loading && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
          )}
          
          {error ? (
              <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <span>{error}</span>
              </div>
          ) : expenses.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                  暂无数据
              </div>
          ) : (
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left table-fixed">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                          <tr>
                              <th className="px-4 py-3 w-8"></th>
                              <th 
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap w-36"
                                onClick={() => toggleSort('expense_date')}
                              >
                                  <div className="flex items-center gap-1">
                                      日期
                                      {sortField === 'expense_date' && (
                                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                      )}
                                  </div>
                              </th>
                              <th 
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap w-44"
                                onClick={() => toggleSort('category')}
                              >
                                  <div className="flex items-center gap-1">
                                      项目/分类
                                      {sortField === 'category' && (
                                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                      )}
                                  </div>
                              </th>
                              <th className="px-4 py-3 whitespace-nowrap">说明</th>
                              <th 
                                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap w-28"
                                onClick={() => toggleSort('amount')}
                              >
                                  <div className="flex items-center justify-end gap-1">
                                      金额
                                      {sortField === 'amount' && (
                                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                      )}
                                  </div>
                              </th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {expenses.map(expense => (
                              <>
                                  <tr 
                                    key={expense.id} 
                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => toggleRow(expense.id)}
                                  >
                                      <td className="px-4 py-3 text-gray-400">
                                          {expandedRows.includes(expense.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                      </td>
                                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                          {format(new Date(expense.expense_date), 'yyyy-MM-dd HH:mm')}
                                      </td>
                                      <td className="px-4 py-3">
                                          <div className="font-medium text-gray-900 truncate" title={expense.category}>{expense.category}</div>
                                          {(expense.project || expense.sub_category) && (
                                              <div className="text-xs text-gray-500 mt-0.5 truncate" title={[expense.project, expense.sub_category].filter(Boolean).join(' / ')}>
                                                  {expense.project || ''}
                                                  {expense.project && expense.sub_category && ' / '}
                                                  {expense.sub_category || ''}
                                              </div>
                                          )}
                                      </td>
                                      <td className="px-4 py-3 text-gray-600 truncate" title={expense.description}>
                                          {expense.description}
                                      </td>
                                      <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${expense.amount > 1000 ? 'text-rose-600' : 'text-gray-900'}`}>
                                          ¥{expense.amount.toFixed(2)}
                                      </td>
                                  </tr>
                                  {expandedRows.includes(expense.id) && (
                                      <tr className="bg-gray-50/50">
                                          <td colSpan={5} className="px-4 py-3 pl-12">
                                              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                                                  <div>
                                                      <span className="text-gray-400">备注：</span>
                                                      {expense.description || '-'}
                                                  </div>
                                                  <div>
                                                      <span className="text-gray-400">支付方式：</span>
                                                      {expense.payment_method || '-'}
                                                  </div>
                                                  <div>
                                                      <span className="text-gray-400">记录ID：</span>
                                                      #{expense.id}
                                                  </div>
                                                  {/* Add more fields if needed */}
                                              </div>
                                          </td>
                                      </tr>
                                  )}
                              </>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
          
          {/* Pagination */}
          {totalCount > pageSize && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                      显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, totalCount)} 条，共 {totalCount} 条
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= totalCount}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <ChevronRight className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  )
}
