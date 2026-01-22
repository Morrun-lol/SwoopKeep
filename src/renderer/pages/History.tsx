import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Trash2, Search, Calendar, Filter } from 'lucide-react'

interface ExpenseRecord {
  id: number
  category: string
  amount: number
  expense_date: string
  description: string
  voice_text?: string
  created_at: string
}

interface ExpenseCategory {
  id: number
  name: string
  icon?: string
  color?: string
}

export default function History() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [categoriesData] = await Promise.all([
        window.api.getAllCategories()
      ])
      setCategories(categoriesData)
      
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      setDateRange({
        start: format(firstDay, 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd')
      })
      
      await loadExpenses(format(firstDay, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd'))
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExpenses = async (startDate: string, endDate: string) => {
    try {
      let data: ExpenseRecord[] = await window.api.getExpensesByDateRange(startDate, endDate)
      
      if (selectedCategory !== 'all') {
        data = data.filter(e => e.category === selectedCategory)
      }
      
      if (searchKeyword) {
        data = data.filter(e => 
          e.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          (e.voice_text && e.voice_text.toLowerCase().includes(searchKeyword.toLowerCase()))
        )
      }
      
      setExpenses(data)
    } catch (error) {
      console.error('Failed to load expenses:', error)
    }
  }

  const handleSearch = async () => {
    if (!dateRange.start || !dateRange.end) return
    await loadExpenses(dateRange.start, dateRange.end)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) return
    
    try {
      setDeletingId(id)
      await window.api.deleteExpense(id)
      await handleSearch()
    } catch (error) {
      console.error('Failed to delete expense:', error)
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const getCategoryInfo = (categoryName: string) => {
    return categories.find(c => c.name === categoryName) || { icon: '📦', color: '#6B7280' }
  }

  const groupedExpenses = expenses.reduce((acc, expense) => {
    const date = expense.expense_date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(expense)
    return acc
  }, {} as Record<string, ExpenseRecord[]>)

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  const handleClearAll = async () => {
    if (!confirm('警告：确定要清空所有记录吗？此操作无法撤销！')) return
    
    try {
      setLoading(true)
      await window.api.clearAllData()
      await loadData() // Reload
      alert('已清空所有数据')
    } catch (error) {
      console.error('Failed to clear data:', error)
      alert('清空失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">历史记录</h1>
        {/* 清空所有数据按钮已移除 */}
      </div>
      
      {/* 统计卡片 */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm mb-1">总计支出</p>
            <p className="text-3xl font-bold">¥{totalAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-sm mb-1">记录数</p>
            <p className="text-2xl font-semibold">{expenses.length}</p>
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索备注或咻记一下内容..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
          
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            搜索
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                >
                  <option value="all">全部分类</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 记录列表 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      ) : Object.keys(groupedExpenses).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedExpenses).map(([date, dayExpenses]) => (
            <div key={date} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className="font-semibold text-gray-700">{format(new Date(date), 'yyyy年MM月dd日')}</span>
                <span className="text-sm text-gray-500">
                  ¥{dayExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {dayExpenses.map(expense => {
                  const catInfo = getCategoryInfo(expense.category)
                  return (
                    <div key={expense.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                            style={{ backgroundColor: `${catInfo.color}20` }}
                          >
                            {catInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                            <p className="text-sm text-gray-500">{expense.category}</p>
                            {expense.voice_text && (
                              <p className="text-xs text-gray-400 mt-1 truncate">咻记一下: {expense.voice_text}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-semibold text-emerald-600">
                            ¥{expense.amount.toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleDelete(expense.id)}
                            disabled={deletingId === expense.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
