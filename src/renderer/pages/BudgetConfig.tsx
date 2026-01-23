import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Upload, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Settings, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import ExpenseTypeManager from '../components/ExpenseTypeManager'
import { formatMoneyInt } from '../lib/format'

interface ExpenseType {
  id: number
  name: string
  is_active: number
}

interface YearGoal {
  id: number
  year: number
  project: string
  category: string
  sub_category: string
  goal_amount: number
  expense_type: string
}

export default function BudgetConfig() {
  const [mode, setMode] = useState<'year' | 'month'>('year')
  const [goals, setGoals] = useState<YearGoal[]>([])
  const [monthlyBudgets, setMonthlyBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [isAdding, setIsAdding] = useState(false)
  const [structure, setStructure] = useState<{ project: string, category: string, sub_category: string }[]>([])
  
  // Expense Types
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([])
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false)

  // Ledger Selection State
  const [families, setFamilies] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selectedLedger, setSelectedLedger] = useState<{ type: 'family' | 'member', id: number | null, name: string }>({ type: 'family', id: null, name: '家庭共享' })
  const [ledgerDropdownOpen, setLedgerDropdownOpen] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProject, setFilterProject] = useState('')

  // Sorting
  const [sortField, setSortField] = useState<keyof YearGoal | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // New Item State
  const [newItem, setNewItem] = useState<{
    project: string
    category: string
    sub_category: string
    goal_amount: number
    expense_type: string
  }>({
    project: '',
    category: '',
    sub_category: '',
    goal_amount: 0,
    expense_type: '' // Default empty, user must select
  })

  const [newMonthlyItem, setNewMonthlyItem] = useState<{
    project: string
    category: string
    sub_category: string
    budget_amount: number
  }>({
    project: '',
    category: '',
    sub_category: '',
    budget_amount: 0,
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (mode === 'year') {
      loadData()
    } else {
      loadMonthlyBudgets()
    }
    loadStructure()
    loadExpenseTypes()
  }, [year, month, selectedLedger, mode])

  const loadInitialData = async () => {
    try {
        const [familiesData, membersData] = await Promise.all([
            window.api.getAllFamilies(),
            window.api.getAllMembers()
        ])
        setFamilies(familiesData)
        setMembers(membersData)
        
        // Set default ledger to first family if available
        if (familiesData.length > 0) {
            setSelectedLedger({ type: 'family', id: familiesData[0].id, name: familiesData[0].name })
        }
    } catch (e) {
        console.error('Failed to load initial ledger data', e)
    }
  }

  const loadExpenseTypes = async () => {
    const types = await window.api.getAllExpenseTypes()
    setExpenseTypes(types)
    // Set default expense type if available and not set
    if (types.length > 0 && !newItem.expense_type) {
        // We don't set default here as requirement says "default empty, must select"
        // But for convenience, we might want to? No, stick to requirements: "default value is empty, must select from dropdown"
    }
  }

  const loadStructure = async () => {
    try {
      const data = await window.api.getExpenseStructure()
      setStructure(data)
    } catch (error) {
      console.error('Failed to load structure:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const memberId = selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined
      const data = await window.api.getYearGoals(year, memberId)
      setGoals(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadMonthlyBudgets = async () => {
    setLoading(true)
    try {
      const data = await window.api.getMonthlyBudgets(year, month)
      setMonthlyBudgets(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (item: any) => {
    try {
      const memberId = selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined
      const newData = await window.api.saveYearGoal({ ...item, year, member_id: memberId })
      setGoals(newData)
    } catch (e) {
      alert('保存失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个预算目标吗？')) return
    
    // Optimistic update
    setGoals(prev => prev.filter(item => item.id !== id))
    
    try {
        const memberId = selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined
        const newData = await window.api.deleteYearGoal(id, year, memberId)
        setGoals(newData)
    } catch (e) {
        alert('删除失败')
        loadData()
    }
  }

  const handleAddNew = async () => {
    if (!newItem.category) {
        alert('分类名称必填')
        return
    }
    if (!newItem.expense_type) {
        alert('请选择费用类型')
        return
    }

    try {
        const memberId = selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined
        const newData = await window.api.saveYearGoal({ ...newItem, year, member_id: memberId })
        setNewItem({ project: '', category: '', sub_category: '', goal_amount: 0, expense_type: '' })
        setIsAdding(false)
        if (Array.isArray(newData)) {
            setGoals(newData)
        } else {
            loadData()
        }
    } catch (e) {
        console.error(e)
        alert('保存失败')
    }
  }

  const handleSaveMonthly = async (item: any) => {
    try {
      const ok = await window.api.saveMonthlyBudget({
        ...item,
        year,
        month,
      })
      if (!ok) throw new Error('save failed')
      await loadMonthlyBudgets()
    } catch (e) {
      alert('保存失败')
    }
  }

  const handleDeleteMonthly = async (id: number) => {
    if (!confirm('确定要删除这个月度预算吗？')) return
    setMonthlyBudgets(prev => prev.filter(item => item.id !== id))
    try {
      const ok = await window.api.deleteMonthlyBudget(id)
      if (!ok) throw new Error('delete failed')
      await loadMonthlyBudgets()
    } catch (e) {
      alert('删除失败')
      loadMonthlyBudgets()
    }
  }

  const handleAddNewMonthly = async () => {
    if (!newMonthlyItem.category) {
      alert('分类名称必填')
      return
    }

    try {
      const ok = await window.api.saveMonthlyBudget({
        ...newMonthlyItem,
        year,
        month,
      })
      if (!ok) throw new Error('save failed')
      setNewMonthlyItem({ project: '', category: '', sub_category: '', budget_amount: 0 })
      setIsAdding(false)
      await loadMonthlyBudgets()
    } catch (e) {
      console.error(e)
      alert('保存失败')
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const buffer = await file.arrayBuffer()
        const memberId = selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined
        const result = await window.api.importBudgetGoals(buffer, year, memberId)
        alert(`导入成功！成功: ${result.success} 条，失败: ${result.failed} 条`)
        loadData()
      } catch (error: any) {
        alert(error.message)
      }
    }
    input.click()
  }

  const handleSort = (field: keyof YearGoal) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Derived Data
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      const matchesSearch = searchQuery === '' || 
        goal.project?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.sub_category?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = filterType === '' || goal.expense_type === filterType
      const matchesProject = filterProject === '' || goal.project === filterProject

      return matchesSearch && matchesType && matchesProject
    })
  }, [goals, searchQuery, filterType, filterProject])

  const sortedGoals = useMemo(() => {
    if (!sortField) return filteredGoals
    
    return [...filteredGoals].sort((a, b) => {
      const aVal = a[sortField] || ''
      const bVal = b[sortField] || ''
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal), 'zh-CN')
        : String(bVal).localeCompare(String(aVal), 'zh-CN')
    })
  }, [filteredGoals, sortField, sortDirection])

  const paginatedGoals = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedGoals.slice(start, start + pageSize)
  }, [sortedGoals, currentPage, pageSize])

  const totalPages = Math.ceil(sortedGoals.length / pageSize)

  // Options for dropdowns
  const projectOptions = Array.from(new Set(structure.map(s => s.project))).filter(Boolean)
  const categoryOptions = Array.from(new Set(structure
    .filter(s => !newItem.project || s.project === newItem.project)
    .map(s => s.category)
  )).filter(Boolean)
  const subCategoryOptions = Array.from(new Set(structure
    .filter(s => (!newItem.project || s.project === newItem.project) && (!newItem.category || s.category === newItem.category))
    .map(s => s.sub_category)
  )).filter(Boolean)

  const activeExpenseTypes = expenseTypes.filter(t => t.is_active)

  const filteredMonthlyBudgets = useMemo(() => {
    return monthlyBudgets.filter(b => {
      const project = (b.project || '').toString()
      const category = (b.category || '').toString()
      const subCategory = (b.sub_category || '').toString()
      const matchesSearch = searchQuery === '' ||
        project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subCategory.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesProject = filterProject === '' || project === filterProject
      return matchesSearch && matchesProject
    })
  }, [monthlyBudgets, searchQuery, filterProject])

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col pb-20 md:pb-0">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">预算配置</h1>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => { setMode('year'); setIsAdding(false) }}
                className={`px-2 py-1 text-xs rounded-md transition-all ${
                  mode === 'year' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                年度目标
              </button>
              <button
                onClick={() => { setMode('month'); setIsAdding(false) }}
                className={`px-2 py-1 text-xs rounded-md transition-all ${
                  mode === 'month' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                月度预算
              </button>
            </div>

            {/* Member Selector */}
            <div className="relative z-20">
                <button
                    onClick={() => setLedgerDropdownOpen(!ledgerDropdownOpen)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs md:text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors"
                >
                    {selectedLedger.name}
                    <ArrowDown className={`w-3 h-3 md:w-4 md:h-4 transition-transform ${ledgerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {ledgerDropdownOpen && (
                    <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                        {families.map(family => (
                            <div key={family.id}>
                                <button
                                    onClick={() => {
                                        setSelectedLedger({ type: 'family', id: family.id, name: family.name })
                                        setLedgerDropdownOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm font-bold flex items-center justify-between ${
                                        selectedLedger.type === 'family' && selectedLedger.id === family.id 
                                        ? 'bg-gray-50 text-gray-900' 
                                        : 'text-gray-900 hover:bg-gray-50'
                                    }`}
                                >
                                    {family.name}
                                </button>
                                {/* Members of this family */}
                                {members.filter(m => m.family_id === family.id).map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => {
                                            setSelectedLedger({ type: 'member', id: member.id, name: member.name })
                                            setLedgerDropdownOpen(false)
                                        }}
                                        className={`w-full text-left px-8 py-2 text-sm flex items-center justify-between ${
                                            selectedLedger.type === 'member' && selectedLedger.id === member.id 
                                            ? 'bg-gray-50 text-gray-900' 
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {member.name}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 bg-gray-50 px-2 md:px-3 py-1.5 rounded-lg border border-gray-200">
                <span className="text-xs md:text-sm text-gray-500 whitespace-nowrap">年份</span>
                <input 
                    type="number" 
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-12 md:w-16 font-bold text-gray-900 outline-none bg-transparent text-sm md:text-base"
                />
            </div>

            {mode === 'month' && (
              <div className="flex items-center gap-2 bg-gray-50 px-2 md:px-3 py-1.5 rounded-lg border border-gray-200">
                <span className="text-xs md:text-sm text-gray-500 whitespace-nowrap">月份</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-10 md:w-12 font-bold text-gray-900 outline-none bg-transparent text-sm md:text-base"
                />
              </div>
            )}
            <button 
                onClick={() => setIsTypeManagerOpen(true)}
                className="flex items-center gap-1 md:gap-2 text-gray-600 hover:text-gray-900 px-2 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-gray-100 transition-colors text-xs md:text-sm"
            >
                <Settings className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">管理类型</span>
                <span className="sm:hidden">类型</span>
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 md:gap-2 bg-emerald-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg hover:bg-emerald-700 transition-colors text-xs md:text-sm"
            >
              <Plus className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{mode === 'month' ? '新增月度预算' : '新增分类目标'}</span>
              <span className="sm:hidden">新增</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    placeholder="搜索项目、分类、子分类..."
                    className="w-full pl-9 pr-3 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />

              {mode === 'year' && (
                <select 
                  className="border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">所有费用类型</option>
                  {activeExpenseTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              )}

              <select 
                className="border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
              >
                <option value="">所有项目</option>
                {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
        </div>
      </div>

      {/* Add New Form */}
      {isAdding && (
          mode === 'month' ? (
            <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-md animate-in fade-in slide-in-from-top-2">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">新增月度预算</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">项目 (一级)</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newMonthlyItem.project}
                    onChange={e => setNewMonthlyItem({ ...newMonthlyItem, project: e.target.value, category: '', sub_category: '' })}
                  >
                    <option value="">请选择项目</option>
                    {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="custom">+ 自定义输入</option>
                  </select>
                  {newMonthlyItem.project === 'custom' && (
                    <input
                      placeholder="输入新项目名称"
                      className="w-full mt-2 border rounded-lg px-3 py-2"
                      onBlur={e => setNewMonthlyItem({ ...newMonthlyItem, project: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">分类 (二级) <span className="text-red-500">*</span></label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newMonthlyItem.category}
                    onChange={e => setNewMonthlyItem({ ...newMonthlyItem, category: e.target.value, sub_category: '' })}
                  >
                    <option value="">请选择分类</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="custom">+ 自定义输入</option>
                  </select>
                  {newMonthlyItem.category === 'custom' && (
                    <input
                      placeholder="输入新分类名称"
                      className="w-full mt-2 border rounded-lg px-3 py-2"
                      onBlur={e => setNewMonthlyItem({ ...newMonthlyItem, category: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">子分类 (三级)</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newMonthlyItem.sub_category}
                    onChange={e => setNewMonthlyItem({ ...newMonthlyItem, sub_category: e.target.value })}
                  >
                    <option value="">请选择子分类</option>
                    {subCategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="custom">+ 自定义输入</option>
                  </select>
                  {newMonthlyItem.sub_category === 'custom' && (
                    <input
                      placeholder="输入新子分类名称"
                      className="w-full mt-2 border rounded-lg px-3 py-2"
                      onBlur={e => setNewMonthlyItem({ ...newMonthlyItem, sub_category: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-medium">月度预算金额</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">¥</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full border rounded-lg pl-7 pr-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={newMonthlyItem.budget_amount || ''}
                      onChange={e => setNewMonthlyItem({ ...newMonthlyItem, budget_amount: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <button onClick={() => setIsAdding(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium transition-colors">取消</button>
                <button onClick={handleAddNewMonthly} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors">保存配置</button>
              </div>
            </div>
          ) : (
          <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-md animate-in fade-in slide-in-from-top-2">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">新增预算目标</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">费用类型 <span className="text-red-500">*</span></label>
                      <select 
                        className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newItem.expense_type}
                        onChange={e => setNewItem({...newItem, expense_type: e.target.value})}
                      >
                        <option value="">请选择类型</option>
                        {activeExpenseTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">项目 (一级)</label>
                      <select 
                        className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newItem.project}
                        onChange={e => setNewItem({...newItem, project: e.target.value, category: '', sub_category: ''})}
                      >
                        <option value="">请选择项目</option>
                        {projectOptions.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="custom">+ 自定义输入</option>
                      </select>
                      {newItem.project === 'custom' && (
                        <input 
                            placeholder="输入新项目名称"
                            className="w-full mt-2 border rounded-lg px-3 py-2"
                            onBlur={e => setNewItem({...newItem, project: e.target.value})}
                        />
                      )}
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">分类 (二级) <span className="text-red-500">*</span></label>
                      <select 
                        className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newItem.category}
                        onChange={e => setNewItem({...newItem, category: e.target.value, sub_category: ''})}
                      >
                        <option value="">请选择分类</option>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="custom">+ 自定义输入</option>
                      </select>
                      {newItem.category === 'custom' && (
                        <input 
                            placeholder="输入新分类名称"
                            className="w-full mt-2 border rounded-lg px-3 py-2"
                            onBlur={e => setNewItem({...newItem, category: e.target.value})}
                        />
                      )}
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">子分类 (三级)</label>
                      <select 
                        className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newItem.sub_category}
                        onChange={e => setNewItem({...newItem, sub_category: e.target.value})}
                      >
                        <option value="">请选择子分类</option>
                        {subCategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="custom">+ 自定义输入</option>
                      </select>
                      {newItem.sub_category === 'custom' && (
                        <input 
                            placeholder="输入新子分类名称"
                            className="w-full mt-2 border rounded-lg px-3 py-2"
                            onBlur={e => setNewItem({...newItem, sub_category: e.target.value})}
                        />
                      )}
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs text-gray-500 font-medium">年度预算金额</label>
                      <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-400">¥</span>
                          <input 
                            type="number"
                            placeholder="0.00" 
                            className="w-full border rounded-lg pl-7 pr-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={newItem.goal_amount || ''}
                            onChange={e => setNewItem({...newItem, goal_amount: Number(e.target.value)})}
                          />
                      </div>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t">
                  <button onClick={() => setIsAdding(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium transition-colors">取消</button>
                  <button onClick={handleAddNew} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors">保存配置</button>
              </div>
          </div>
          )
      )}

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {mode === 'year' ? (
          <>
            {/* Mobile View: Cards */}
            <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3">
                 {paginatedGoals.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                        <p className="mb-2">暂无配置</p>
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="text-emerald-600 font-medium"
                        >
                            点击新增
                        </button>
                    </div>
                 ) : (
                     paginatedGoals.map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm relative">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex-none">
                                        {item.expense_type}
                                    </span>
                                    <h3
                                      className="text-sm font-bold text-gray-900 min-w-0 truncate"
                                      title={`${String(item.project || '').trim() || '无项目'} - ${(() => {
                                        const s = String(item.category || '').trim()
                                        return !s || s === 'undefined' || s === 'null' ? '无分类' : s
                                      })()}`}
                                    >
                                      {String(item.project || '').trim() || '无项目'} - {(() => {
                                        const s = String(item.category || '').trim()
                                        return !s || s === 'undefined' || s === 'null' ? '无分类' : s
                                      })()}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-2 flex-none">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">目标金额</span>
                                  <span className="text-sm font-bold text-gray-900 font-mono tabular-nums whitespace-nowrap">{formatMoneyInt(item.goal_amount)}</span>
                                  <button 
                                      onClick={() => handleDelete(item.id)}
                                      className="text-gray-400 hover:text-red-500 p-1"
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                            </div>

                            <div className="text-xs text-gray-500 min-w-0">
                                {item.sub_category && (
                                  <span className="block truncate" title={String(item.sub_category)}>
                                    子分类: {item.sub_category}
                                  </span>
                                )}
                            </div>
                        </div>
                     ))
                 )}
            </div>

            <div className="hidden md:block flex-1 overflow-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0">
                        <tr>
                            {[
                                { label: '费用类型', key: 'expense_type' },
                                { label: '项目 (一级)', key: 'project' },
                                { label: '分类 (二级)', key: 'category' },
                                { label: '子分类 (三级)', key: 'sub_category' },
                                { label: '年度预算', key: 'goal_amount', align: 'right' }
                            ].map((col) => (
                                <th 
                                    key={col.key} 
                                    className={`px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                                    onClick={() => handleSort(col.key as keyof YearGoal)}
                                >
                                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                        {col.label}
                                        {sortField === col.key ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                                    </div>
                                </th>
                            ))}
                            <th className="px-6 py-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedGoals.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    {searchQuery ? '未找到匹配的记录' : '暂无配置，请点击右上角新增'}
                                </td>
                            </tr>
                        ) : (
                            paginatedGoals.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-3 align-middle">
                                        <select
                                            className={`w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors text-xs font-medium py-1 ${
                                                item.expense_type?.includes('固定') 
                                                ? 'text-blue-800' 
                                                : 'text-emerald-800'
                                            }`}
                                            value={item.expense_type || ''}
                                            onChange={(e) => {
                                                const newVal = e.target.value;
                                                setGoals(prev => prev.map(g => g.id === item.id ? { ...g, expense_type: newVal } : g))
                                                handleSave({...item, expense_type: newVal})
                                            }}
                                        >
                                            <option value="">请选择</option>
                                            {activeExpenseTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-3 align-middle">
                                        <input 
                                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors text-gray-900"
                                            value={item.project || ''}
                                            onChange={(e) => {
                                                const newVal = e.target.value;
                                                setGoals(prev => prev.map(g => g.id === item.id ? { ...g, project: newVal } : g))
                                            }}
                                            onBlur={(e) => handleSave({...item, project: e.target.value})}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter') e.currentTarget.blur()
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-3 align-middle">
                                        <input 
                                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors font-medium text-gray-900"
                                            value={item.category || ''}
                                            onChange={(e) => {
                                                const newVal = e.target.value;
                                                setGoals(prev => prev.map(g => g.id === item.id ? { ...g, category: newVal } : g))
                                            }}
                                            onBlur={(e) => handleSave({...item, category: e.target.value})}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter') e.currentTarget.blur()
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-3 align-middle">
                                        <input 
                                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors text-gray-500"
                                            value={item.sub_category || ''}
                                            onChange={(e) => {
                                                const newVal = e.target.value;
                                                setGoals(prev => prev.map(g => g.id === item.id ? { ...g, sub_category: newVal } : g))
                                            }}
                                            onBlur={(e) => handleSave({...item, sub_category: e.target.value})}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter') e.currentTarget.blur()
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-3 text-right align-middle">
                                        <input 
                                            type="number" 
                                            className="w-32 text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors font-mono"
                                            value={item.goal_amount}
                                            onChange={(e) => {
                                                const newVal = e.target.value;
                                                setGoals(prev => prev.map(g => g.id === item.id ? { ...g, goal_amount: Number(newVal) } : g))
                                            }}
                                            onBlur={(e) => handleSave({...item, goal_amount: Number(e.target.value)})}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter') {
                                                    e.currentTarget.blur()
                                                }
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-3 text-right align-middle">
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination & Summary */}
            <div className="bg-gray-50 px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-xs text-gray-500 whitespace-nowrap order-2 md:order-1">
                    共 {sortedGoals.length} 条记录，当前显示 {paginatedGoals.length} 条
                </div>
                <div className="flex flex-wrap items-center gap-3 justify-center order-1 md:order-2 w-full md:w-auto">
                    <select 
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value))
                            setCurrentPage(1)
                        }}
                        className="h-10 border rounded-lg px-3 text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500 min-w-[100px]"
                    >
                        <option value="10">10 条/页</option>
                        <option value="20">20 条/页</option>
                        <option value="50">50 条/页</option>
                        <option value="100">100 条/页</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-gray-700 whitespace-nowrap min-w-[40px] text-center">
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
          </>
        ) : (
          <>
            <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3">
              {filteredMonthlyBudgets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                  <p className="mb-2">暂无配置</p>
                  <button onClick={() => setIsAdding(true)} className="text-emerald-600 font-medium">点击新增</button>
                </div>
              ) : (
                filteredMonthlyBudgets.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm relative">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          {(item.project || '无项目')} - {(item.category || '无分类')}
                        </h3>
                        {item.sub_category && <div className="text-xs text-gray-500 mt-1">子分类: {item.sub_category}</div>}
                      </div>
                      <button onClick={() => handleDeleteMonthly(item.id)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-xs text-gray-500">月度预算</div>
                      <input
                        type="number"
                        className="w-32 text-right bg-white border rounded px-2 py-1 font-mono"
                        value={Number(item.budget_amount ?? 0)}
                        onChange={(e) => {
                          const newVal = Number(e.target.value)
                          setMonthlyBudgets(prev => prev.map(b => b.id === item.id ? { ...b, budget_amount: newVal } : b))
                        }}
                        onBlur={() => handleSaveMonthly(item)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block flex-1 overflow-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">项目 (一级)</th>
                    <th className="px-6 py-3">分类 (二级)</th>
                    <th className="px-6 py-3">子分类 (三级)</th>
                    <th className="px-6 py-3 text-right">月度预算</th>
                    <th className="px-6 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMonthlyBudgets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        {searchQuery ? '未找到匹配的记录' : '暂无配置，请点击右上角新增'}
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlyBudgets.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-50 group">
                        <td className="px-6 py-3">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors text-gray-900"
                            value={item.project || ''}
                            onChange={(e) => {
                              const newVal = e.target.value
                              setMonthlyBudgets(prev => prev.map(b => b.id === item.id ? { ...b, project: newVal } : b))
                            }}
                            onBlur={(e) => handleSaveMonthly({ ...item, project: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors font-medium text-gray-900"
                            value={item.category || ''}
                            onChange={(e) => {
                              const newVal = e.target.value
                              setMonthlyBudgets(prev => prev.map(b => b.id === item.id ? { ...b, category: newVal } : b))
                            }}
                            onBlur={(e) => handleSaveMonthly({ ...item, category: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors text-gray-500"
                            value={item.sub_category || ''}
                            onChange={(e) => {
                              const newVal = e.target.value
                              setMonthlyBudgets(prev => prev.map(b => b.id === item.id ? { ...b, sub_category: newVal } : b))
                            }}
                            onBlur={(e) => handleSaveMonthly({ ...item, sub_category: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <input
                            type="number"
                            className="w-32 text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-emerald-500 outline-none transition-colors font-mono"
                            value={Number(item.budget_amount ?? 0)}
                            onChange={(e) => {
                              const newVal = Number(e.target.value)
                              setMonthlyBudgets(prev => prev.map(b => b.id === item.id ? { ...b, budget_amount: newVal } : b))
                            }}
                            onBlur={(e) => handleSaveMonthly({ ...item, budget_amount: Number(e.target.value) })}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => handleDeleteMonthly(item.id)}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-4 md:px-6 py-4 border-t border-gray-200 flex justify-between items-center gap-4">
              <div className="text-xs text-gray-500 whitespace-nowrap">
                共 {filteredMonthlyBudgets.length} 条记录
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                修改后移出输入框自动保存
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Import & Footer */}
      {mode === 'year' && (
        <div className="bg-blue-50 p-4 md:p-6 rounded-xl text-blue-800 text-sm flex-shrink-0">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
              <div className="flex-1">
                  <p className="flex items-center gap-2 font-bold text-base mb-2">
                      <Upload className="w-5 h-5" /> 
                      批量导入预算
                  </p>
                  <p className="text-xs md:text-sm text-blue-700/80 leading-relaxed max-w-2xl">
                      您可以上传包含预算目标的 Excel 文件。请先下载标准模板，按格式填写后上传。
                      <br className="hidden md:block" />
                      支持格式：.xlsx, .xls
                  </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <button 
                      onClick={() => window.api.downloadBudgetTemplate()}
                      className="h-12 px-6 bg-white border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition-all text-xs md:text-sm font-bold flex items-center justify-center gap-2 shadow-sm whitespace-nowrap active:scale-[0.98]"
                  >
                      <Download className="w-4 h-4" />
                      下载模板
                  </button>
                  <button 
                      onClick={handleImport}
                      className="h-12 px-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-xs md:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-200 whitespace-nowrap active:scale-[0.98]"
                  >
                      <Upload className="w-4 h-4" />
                      上传 Excel
                  </button>
              </div>
            </div>
        </div>
      )}

      <ExpenseTypeManager 
        isOpen={isTypeManagerOpen}
        onClose={() => setIsTypeManagerOpen(false)}
        onChange={loadExpenseTypes}
      />
    </div>
  )
}
