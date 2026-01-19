import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Calendar, TrendingUp, TrendingDown, Target, ChevronDown, ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfQuarter, endOfYear, startOfQuarter, getYear, setMonth, setYear } from 'date-fns'
import Statistics from './Statistics' 
import BudgetSummary from '../components/BudgetSummary'

type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

// Helper to calculate time progress (copied from BudgetSummary, ideally should be shared util)
const getTimeProgress = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear(), 11, 31)
    const total = end.getTime() - start.getTime()
    const current = now.getTime() - start.getTime()
    return Math.min((current / total) * 100, 100)
}

export default function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  
  // Anchor date for relative time periods (e.g. selected specific month)
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [activePopover, setActivePopover] = useState<string | null>(null)
  
  const [totalAmount, setTotalAmount] = useState(0)
  const [expenseCount, setExpenseCount] = useState(0)
  
  // Financial Progress State (New)
  const [periodGoal, setPeriodGoal] = useState(0)
  const [regularActual, setRegularActual] = useState(0)

  // Ledger Selection State
  const [families, setFamilies] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selectedLedger, setSelectedLedger] = useState<{ type: 'family' | 'member', id: number | null, name: string }>({ type: 'family', id: null, name: '家庭共享' })
  const [ledgerDropdownOpen, setLedgerDropdownOpen] = useState(false)
  
  // Interaction State for Detail View
  const statisticsSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadData()
  }, [timePeriod, customDateRange, anchorDate, selectedLedger]) // Removed detailFilter dependency

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

  const getDateRange = () => {
    const now = anchorDate
    switch (timePeriod) {
      case 'day':
        return {
            start: format(startOfDay(now), 'yyyy-MM-dd'),
            end: format(endOfDay(now), 'yyyy-MM-dd')
        }
      case 'week':
        return {
          start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        }
      case 'month':
        return {
          start: format(startOfMonth(now), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd')
        }
      case 'quarter':
        return {
            start: format(startOfQuarter(now), 'yyyy-MM-dd'),
            end: format(endOfQuarter(now), 'yyyy-MM-dd')
        }
      case 'year':
        return {
          start: format(startOfYear(now), 'yyyy-MM-dd'),
          end: format(endOfYear(now), 'yyyy-MM-dd')
        }
      case 'custom':
        return {
          start: customDateRange.start || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
          end: customDateRange.end || format(endOfMonth(new Date()), 'yyyy-MM-dd')
        }
      default:
        return {
          start: format(startOfMonth(now), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd')
        }
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const { start, end } = getDateRange()
      const year = getYear(anchorDate)
      
      const memberId = selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined

      const [totalData, comparisonData] = await Promise.all([
        window.api.getTotalAmountByDateRange(start, end, memberId),
        window.api.getGoalComparison(year, start, end, memberId)
      ])

      setTotalAmount(totalData.total_amount || 0)
      setExpenseCount(totalData.total_count || 0)
      
      // Calculate Regular Budget Goal & Actual
      // Filter out Fixed Expenses
      const regularItems = comparisonData.filter((item: any) => item.expense_type !== '固定费用')
      
      // 1. Calculate Total Annual Goal for Regular Items
      const totalRegularAnnualGoal = regularItems.reduce((sum: number, item: any) => sum + item.goal, 0)
      
      // 2. Calculate Actual Spending for Regular Items in this period
      const currentRegularActual = regularItems.reduce((sum: number, item: any) => sum + item.actual, 0)
      setRegularActual(currentRegularActual)

      // 3. Calculate Period Goal
      let calculatedGoal = 0
      if (timePeriod === 'year') {
          // If natural year, use total annual goal
          calculatedGoal = totalRegularAnnualGoal
      } else {
          // Pro-rate based on days
          const startDate = new Date(start)
          const endDate = new Date(end)
          const days = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1
          calculatedGoal = (totalRegularAnnualGoal / 365) * days
      }
      setPeriodGoal(calculatedGoal)

    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate Progress Stats
  const timeProgress = getTimeProgress() // This is Year progress. For Month view, we should calculate Month Progress.
  // Actually, let's make timeProgress dynamic based on timePeriod.
  const getDynamicTimeProgress = () => {
      const now = new Date()
      const { start, end } = getDateRange()
      const startDate = new Date(start)
      const endDate = new Date(end)
      const totalTime = endDate.getTime() - startDate.getTime()
      
      // If current time is outside the range (e.g. past month), progress is 100%
      if (now > endDate) return 100
      if (now < startDate) return 0
      
      const passedTime = now.getTime() - startDate.getTime()
      return Math.min((passedTime / totalTime) * 100, 100)
  }
  
  const currentProgress = getDynamicTimeProgress()
  
  // Use regularActual for spending progress calculation to match the goal
  const spendingProgress = periodGoal > 0 ? (regularActual / periodGoal) * 100 : 0
  
  const isOverSpending = spendingProgress > currentProgress
  const progressColor = isOverSpending ? '#FF1493' : '#32CD32' // DeepPink vs LimeGreen
  const statusText = isOverSpending ? '省点花' : '干得好'
  const statusAnimation = isOverSpending ? 'animate-pulse' : 'animate-pulse' // Use pulse for both but maybe different intensity?
  // Custom blink for warning? Tailwind 'animate-ping' is expanding. 'animate-pulse' is opacity.
  // We can just use text color and bold for now as requested.

  // ... (Selectors Components kept same) ...
  // Month Selector Component
  const MonthSelector = ({ onClose }: { onClose: () => void }) => {
      const [viewYear, setViewYear] = useState(getYear(anchorDate))
      
      const months = Array.from({ length: 12 }, (_, i) => i)
      
      return (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={onClose}></div>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xs bg-white rounded-xl shadow-2xl p-4 z-50 md:absolute md:top-full md:right-0 md:left-auto md:translate-x-0 md:translate-y-0 md:mt-2 md:w-64 md:shadow-xl md:border md:border-gray-100">
              <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setViewYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded-full">
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="font-bold text-gray-900">{viewYear}年</span>
                  <button onClick={() => setViewYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded-full">
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                  {months.map(m => (
                      <button
                          key={m}
                          onClick={() => {
                              const newDate = setMonth(setYear(new Date(), viewYear), m)
                              setAnchorDate(newDate)
                              setTimePeriod('month')
                              onClose()
                          }}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              getYear(anchorDate) === viewYear && anchorDate.getMonth() === m
                              ? 'bg-emerald-500 text-white'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                          {m + 1}月
                      </button>
                  ))}
              </div>
            </div>
          </>
      )
  }

  // Quarter Selector Component
  const QuarterSelector = ({ onClose }: { onClose: () => void }) => {
      const [viewYear, setViewYear] = useState(getYear(anchorDate))
      
      const quarters = [1, 2, 3, 4]
      
      return (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={onClose}></div>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xs bg-white rounded-xl shadow-2xl p-4 z-50 md:absolute md:top-full md:right-0 md:left-auto md:translate-x-0 md:translate-y-0 md:mt-2 md:w-64 md:shadow-xl md:border md:border-gray-100">
              <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setViewYear(y => y - 1)} className="p-1 hover:bg-gray-100 rounded-full">
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="font-bold text-gray-900">{viewYear}年</span>
                  <button onClick={() => setViewYear(y => y + 1)} className="p-1 hover:bg-gray-100 rounded-full">
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  {quarters.map(q => (
                      <button
                          key={q}
                          onClick={() => {
                              // Q1: month 0, Q2: month 3, Q3: month 6, Q4: month 9
                              const newDate = setMonth(setYear(new Date(), viewYear), (q - 1) * 3)
                              setAnchorDate(newDate)
                              setTimePeriod('quarter')
                              onClose()
                          }}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              getYear(anchorDate) === viewYear && Math.floor(anchorDate.getMonth() / 3) + 1 === q
                              ? 'bg-emerald-500 text-white'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                          Q{q}
                      </button>
                  ))}
              </div>
            </div>
          </>
      )
  }

  // Year Selector Component
  const YearSelector = ({ onClose }: { onClose: () => void }) => {
      const currentYear = getYear(new Date())
      const [startYear, setStartYear] = useState(currentYear - 11)
      
      const years = Array.from({ length: 12 }, (_, i) => startYear + i)
      
      return (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={onClose}></div>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xs bg-white rounded-xl shadow-2xl p-4 z-50 md:absolute md:top-full md:right-0 md:left-auto md:translate-x-0 md:translate-y-0 md:mt-2 md:w-64 md:shadow-xl md:border md:border-gray-100">
               <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setStartYear(y => y - 12)} className="p-1 hover:bg-gray-100 rounded-full">
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <span className="font-bold text-gray-900">{startYear} - {startYear + 11}</span>
                  <button onClick={() => setStartYear(y => y + 12)} className="p-1 hover:bg-gray-100 rounded-full">
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                  {years.map(y => (
                      <button
                          key={y}
                          onClick={() => {
                              const newDate = setYear(new Date(), y)
                              setAnchorDate(newDate)
                              setTimePeriod('year')
                              onClose()
                          }}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              getYear(anchorDate) === y
                              ? 'bg-emerald-500 text-white'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                          {y}
                      </button>
                  ))}
              </div>
            </div>
          </>
      )
  }

  // Custom Date Selector Component
  const CustomDateSelector = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
      const [localStart, setLocalStart] = useState(customDateRange.start)
      const [localEnd, setLocalEnd] = useState(customDateRange.end)
      const containerRef = useRef<HTMLDivElement>(null)
      
      // Sync local state when opening
      useEffect(() => {
        if (isOpen) {
            setLocalStart(customDateRange.start)
            setLocalEnd(customDateRange.end)
        }
      }, [isOpen])

      // Close on click outside
      useEffect(() => {
          if (!isOpen) return
          
          const handleClickOutside = (event: MouseEvent) => {
              if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                  // Check if the click was on the toggle button (to prevent double toggling)
                  // We can't easily check that here without more refs, but usually a timeout on open helps.
                  // For now, we rely on the fact that if they click the "Custom" button again, 
                  // the parent logic might toggle it. 
                  // Actually, clicking "Custom" sets activePopover('custom'). If it's already 'custom', it sets null.
                  // So we just need to ensure we don't interfere.
                  // But here we are setting it to null explicitly.
                  // If user clicks "Custom" button:
                  // 1. "Custom" button onClick fires -> sets activePopover(null) (since it was 'custom')
                  // 2. Click outside fires -> sets onClose() -> activePopover(null)
                  // Result: closed. Correct.
                  
                  // What if user clicks "Custom" button when it is CLOSED?
                  // 1. "Custom" button onClick -> sets activePopover('custom')
                  // 2. Click outside (if logic runs) -> sets null.
                  // We need to ensure this effect doesn't run immediately on open.
                  onClose()
              }
          }

          // Delay adding event listener to avoid catching the initial click that opened it
          const timer = setTimeout(() => {
             document.addEventListener('mousedown', handleClickOutside)
          }, 100)
          
          return () => {
              clearTimeout(timer)
              document.removeEventListener('mousedown', handleClickOutside)
          }
      }, [isOpen, onClose])
      
      const handleConfirm = () => {
          if (localStart && localEnd) {
            setCustomDateRange({ start: localStart, end: localEnd })
            setTimePeriod('custom')
            onClose()
          }
      }

      return (
          <div 
            ref={containerRef}
            className={`
                w-full transition-all duration-500 ease-in-out overflow-hidden
                ${isOpen ? 'max-h-96 opacity-100 mt-4 mb-2' : 'max-h-0 opacity-0 mt-0 mb-0'}
            `}
          >
            <div className="bg-white rounded-xl border-2 border-emerald-100 p-5 shadow-lg mx-1">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      自定义时间范围
                  </h3>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors">
                      ✕
                  </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">开始日期</label>
                      <input 
                        type="date" 
                        className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        value={localStart}
                        onChange={e => setLocalStart(e.target.value)}
                      />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">结束日期</label>
                      <input 
                        type="date" 
                        className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                        value={localEnd}
                        onChange={e => setLocalEnd(e.target.value)}
                      />
                  </div>
              </div>
              
              <div className="mt-5 flex">
                  <button 
                    onClick={handleConfirm}
                    disabled={!localStart || !localEnd}
                    className="w-full bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-200"
                  >
                    确认应用
                  </button>
              </div>
            </div>
          </div>
      )
  }

  // Split Button Component
  const SplitButton = ({
    isActive,
    text,
    onMainClick,
    onArrowClick,
    isOpen
  }: {
    isActive: boolean,
    text: React.ReactNode,
    onMainClick: () => void,
    onArrowClick: (e: React.MouseEvent) => void,
    isOpen: boolean
  }) => {
    return (
        <div className={`flex items-center rounded-lg transition-colors ${
            isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}>
            <button
                onClick={onMainClick}
                className="pl-3 pr-1 py-1.5 text-sm font-medium rounded-l-lg hover:bg-black/10 dark:hover:bg-white/10"
            >
                {text}
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onArrowClick(e)
                }}
                className={`pr-2 pl-1 py-1.5 rounded-r-lg flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10`}
            >
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        </div>
    )
  }

  // Calculate date range for props
  const currentRange = getDateRange()
  
  // Calculate period display name
  const getPeriodDisplayName = () => {
      switch (timePeriod) {
          case 'day': return '日'
          case 'week': return '周'
          case 'month': return '月'
          case 'quarter': return '季'
          case 'year': return '年'
          case 'custom': return '自定义时间段'
          default: return '所选时间段'
      }
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* 顶部：欢迎语 & 账本筛选 & 时间筛选 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">概览</h1>
            <p className="mt-1 text-sm md:text-base text-gray-600">欢迎回来，查看您的财务状况。</p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 items-start sm:items-center">
            {/* 账本选择器 */}
            <div className="relative w-full sm:w-auto">
                <button
                    onClick={() => setLedgerDropdownOpen(!ledgerDropdownOpen)}
                    className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors"
                >
                    <span className="truncate max-w-[150px]">{selectedLedger.name}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${ledgerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {ledgerDropdownOpen && (
                    <>
                        {/* Mobile Overlay */}
                        <div 
                            className="fixed inset-0 bg-black/20 z-40 sm:hidden" 
                            onClick={() => setLedgerDropdownOpen(false)}
                        ></div>
                        
                        {/* Dropdown Content */}
                        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xs bg-white rounded-xl shadow-2xl py-1 z-50 sm:absolute sm:top-full sm:left-0 sm:translate-x-0 sm:translate-y-0 sm:mt-2 sm:w-48 sm:shadow-xl sm:border sm:border-gray-100 max-h-[60vh] overflow-y-auto">
                            {families.map(family => (
                                <div key={family.id}>
                                    <button
                                        onClick={() => {
                                            setSelectedLedger({ type: 'family', id: family.id, name: family.name })
                                            setLedgerDropdownOpen(false)
                                        }}
                                        className={`w-full text-left px-4 py-3 sm:py-2 text-sm font-bold flex items-center justify-between ${
                                            selectedLedger.type === 'family' && selectedLedger.id === family.id 
                                            ? 'bg-gray-50 text-gray-900' 
                                            : 'text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        {family.name}
                                        {selectedLedger.type === 'family' && selectedLedger.id === family.id && <Check className="w-4 h-4 text-emerald-500" />}
                                    </button>
                                    {/* Members of this family */}
                                    {members.filter(m => m.family_id === family.id).map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => {
                                                setSelectedLedger({ type: 'member', id: member.id, name: member.name })
                                                setLedgerDropdownOpen(false)
                                            }}
                                            className={`w-full text-left px-8 py-3 sm:py-2 text-sm flex items-center justify-between ${
                                                selectedLedger.type === 'member' && selectedLedger.id === member.id 
                                                ? 'bg-gray-50 text-gray-900' 
                                                : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            {member.name}
                                            {selectedLedger.type === 'member' && selectedLedger.id === member.id && <Check className="w-3 h-3 text-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* 时间筛选器 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1.5 flex flex-wrap gap-1 items-center w-full sm:w-auto overflow-x-auto no-scrollbar">
                {(['day', 'week', 'month', 'quarter', 'year'] as TimePeriod[]).map(p => {
                    if (p === 'month') {
                        return (
                            <div key={p} className="relative shrink-0">
                                <SplitButton
                                    isActive={timePeriod === 'month'}
                                    isOpen={activePopover === 'month'}
                                    text={
                                        timePeriod === 'month' && getYear(anchorDate) !== getYear(new Date()) 
                                        ? `${format(anchorDate, 'yyyy-MM')}` 
                                        : (timePeriod === 'month' && anchorDate.getMonth() !== new Date().getMonth())
                                            ? `${format(anchorDate, 'M月')}`
                                            : '本月'
                                    }
                                    onMainClick={() => {
                                        setTimePeriod('month')
                                        setAnchorDate(new Date())
                                        setActivePopover(null)
                                    }}
                                    onArrowClick={() => setActivePopover(activePopover === 'month' ? null : 'month')}
                                />
                                {activePopover === 'month' && <MonthSelector onClose={() => setActivePopover(null)} />}
                            </div>
                        )
                    }
                    
                    if (p === 'quarter') {
                        return (
                            <div key={p} className="relative shrink-0">
                                <SplitButton
                                    isActive={timePeriod === 'quarter'}
                                    isOpen={activePopover === 'quarter'}
                                    text={
                                        timePeriod === 'quarter' && getYear(anchorDate) !== getYear(new Date()) 
                                        ? `${getYear(anchorDate)} Q${Math.floor(anchorDate.getMonth()/3)+1}` 
                                        : '本季'
                                    }
                                    onMainClick={() => {
                                        setTimePeriod('quarter')
                                        setAnchorDate(new Date())
                                        setActivePopover(null)
                                    }}
                                    onArrowClick={() => setActivePopover(activePopover === 'quarter' ? null : 'quarter')}
                                />
                                {activePopover === 'quarter' && <QuarterSelector onClose={() => setActivePopover(null)} />}
                            </div>
                        )
                    }

                    if (p === 'year') {
                        return (
                            <div key={p} className="relative shrink-0">
                                <SplitButton
                                    isActive={timePeriod === 'year'}
                                    isOpen={activePopover === 'year'}
                                    text={
                                        timePeriod === 'year' && getYear(anchorDate) !== getYear(new Date()) 
                                        ? `${getYear(anchorDate)}` 
                                        : '本年'
                                    }
                                    onMainClick={() => {
                                        setTimePeriod('year')
                                        setAnchorDate(new Date())
                                        setActivePopover(null)
                                    }}
                                    onArrowClick={() => setActivePopover(activePopover === 'year' ? null : 'year')}
                                />
                                {activePopover === 'year' && <YearSelector onClose={() => setActivePopover(null)} />}
                            </div>
                        )
                    }
                    
                    return (
                        <button
                            key={p}
                            onClick={() => {
                                setTimePeriod(p)
                                setAnchorDate(new Date())
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                                timePeriod === p 
                                ? 'bg-gray-900 text-white' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {p === 'day' ? '今日' : '本周'}
                        </button>
                    )
                })}
                
                <div className="relative shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setActivePopover(activePopover === 'custom' ? null : 'custom')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                            timePeriod === 'custom'
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {timePeriod === 'custom' && customDateRange.start && customDateRange.end 
                         ? `${format(new Date(customDateRange.start), 'MM/dd')}-${format(new Date(customDateRange.end), 'MM/dd')}` 
                         : '自定义'}
                        <Calendar className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
      </div>
      <CustomDateSelector isOpen={activePopover === 'custom'} onClose={() => setActivePopover(null)} />
      
      {/* CTA 按钮 */}
      <button 
        onClick={() => navigate('/voice')}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl p-4 shadow-lg flex items-center justify-center gap-3 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-95 active:bg-emerald-700 group"
      >
        <span className="text-xl md:text-2xl font-bold tracking-wide">咻记一下 🎙️</span>
        <div className="bg-white/20 p-1.5 rounded-full group-hover:rotate-90 transition-transform duration-300">
            <Plus className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
      </button>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* 左侧：支出总数 (保持原有深色风格) */}
        <div 
            onClick={() => {
                if (statisticsSectionRef.current) {
                    // Smooth scroll to statistics section
                    statisticsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-lg h-40 md:h-48 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10">
              <TrendingUp className="w-24 h-24 md:w-32 md:h-32" />
          </div>
          <div className="flex items-center justify-between z-10">
            <h3 className="text-base md:text-lg font-semibold opacity-90">
                {timePeriod === 'day' ? '今日支出' : 
                 timePeriod === 'week' ? '本周支出' :
                 timePeriod === 'month' ? '本月支出' :
                 timePeriod === 'quarter' ? '本季支出' : 
                 timePeriod === 'year' ? '本年支出' : '总支出'}
            </h3>
            <div className="p-2 bg-white/10 rounded-lg">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
            </div>
          </div>
          <div className="z-10">
             <div className="text-4xl md:text-5xl font-bold tracking-tight">
                {loading ? '...' : `¥${totalAmount.toFixed(2)}`}
             </div>
             <div className="mt-2 text-xs md:text-sm opacity-60">
                共 {expenseCount} 笔消费记录
             </div>
          </div>
        </div>
        
        {/* 右侧：财务进度展示区 (改造) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-40 md:h-48 flex flex-col justify-between">
           <div className="flex justify-between items-start">
               {/* 左块：本月目标 */}
               <div>
                   <h3 className="text-gray-900 font-bold text-base md:text-lg">
                       所选时间段目标
                   </h3>
                   <div className="text-gray-500 text-xs md:text-sm mt-1">
                       {periodGoal > 0 ? `¥${periodGoal.toFixed(0)}` : '未设置'}
                   </div>
                   <div className={`text-3xl md:text-4xl font-bold mt-2 ${isOverSpending ? 'text-rose-500' : 'text-emerald-500'}`}>
                       {spendingProgress.toFixed(0)}%
                   </div>
                   <div className="text-xs text-gray-400 mt-1">花费进度</div>
               </div>

               {/* 右块：状态提示 */}
               <div className="text-right">
                   <div className={`text-3xl md:text-4xl font-black tracking-wider ${statusAnimation}`} style={{ color: progressColor }}>
                       {statusText}
                   </div>
                   <div className="text-2xl md:text-3xl font-bold mt-2 text-gray-800">
                       {currentProgress.toFixed(0)}%
                   </div>
                   <div className="text-xs text-gray-400 mt-1">时间进度</div>
               </div>
           </div>
           
           {/* 进度条可视化 */}
           <div className="mt-4 relative h-2 md:h-3 bg-gray-100 rounded-full overflow-hidden">
               {/* 时间进度条 (底色) */}
               <div 
                  className="absolute top-0 left-0 h-full bg-gray-300 transition-all duration-500"
                  style={{ width: `${currentProgress}%` }}
               ></div>
               
               {/* 花费进度条 (覆盖) */}
               <div 
                  className="absolute top-0 left-0 h-full transition-all duration-500 opacity-80"
                  style={{ 
                      width: `${Math.min(spendingProgress, 100)}%`,
                      backgroundColor: progressColor 
                  }}
               ></div>
           </div>
        </div>
      </div>

      {/* 预算汇总模块 (Home Summary) */}
      <BudgetSummary 
        startDate={currentRange.start}
        endDate={currentRange.end}
        periodName={getPeriodDisplayName()}
        memberId={selectedLedger.type === 'member' && selectedLedger.id ? selectedLedger.id : undefined}
      />

      {/* 统计分析模块 (Statistics Component) */}
      <div ref={statisticsSectionRef}>
        <h2 className="text-xl font-bold text-gray-900 mb-6">收支分析</h2>
        <Statistics dateRange={getDateRange()} />
      </div>
    </div>
  )
}
