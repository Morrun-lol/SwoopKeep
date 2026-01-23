import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { formatMoney } from '../lib/format'

interface BudgetSummaryProps {
    startDate: string
    endDate: string
    periodName: string
    memberId?: number
}

export default function BudgetSummary({ startDate, endDate, periodName, memberId }: BudgetSummaryProps) {
    const [regularData, setRegularData] = useState<any[]>([])
    const [fixedData, setFixedData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    // const [timeDimension, setTimeDimension] = useState<TimeDimension>('month') // Removed internal state
    
    const [expandedProjects, setExpandedProjects] = useState<string[]>([])
    const [expandedCategories, setExpandedCategories] = useState<string[]>([])
    const [isModuleExpanded, setIsModuleExpanded] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['regular', 'fixed'])

    useEffect(() => {
        loadData()
    }, [startDate, endDate, memberId]) // Depend on props

    const loadData = async () => {
        setLoading(true)
        try {
            const year = new Date(startDate).getFullYear() // Use start date year or current year?
            // Fixed budget is usually annual, but if we filter by a specific period in a different year, we should probably use that year.
            // But fixed expenses are "Annual" by definition in this app logic (or at least stored as year goals).
            // Let's use the year from startDate.
            
            // 1. Fetch Annual Data (for Fixed Expenses)
            const annualStart = `${year}-01-01`
            const annualEnd = `${year}-12-31`
            const annualData = await window.api.getGoalComparison(year, annualStart, annualEnd, memberId)
            
            // 2. Fetch Period Data (for Regular Expenses)
            // const { start, end } = getTimeRange(timeDimension) // Use props
            const periodData = await window.api.getGoalComparison(year, startDate, endDate, memberId)

            // Filter Fixed from Annual Data
            const fixed = annualData.filter((item: any) => item.expense_type === '固定费用')
            
            // Filter Regular from Period Data
            const regular = periodData.filter((item: any) => item.expense_type !== '固定费用')

            setFixedData(fixed)
            setRegularData(regular)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Helper to calculate prorated goal for Regular expenses
    const getProratedGoal = (annualGoal: number) => {
        // Calculate days ratio
        const start = new Date(startDate).getTime()
        const end = new Date(endDate).getTime()
        const days = (end - start) / (1000 * 60 * 60 * 24) + 1
        
        // Annual days (leap year check?) - simplified to 365
        return (annualGoal / 365) * days
    }

    // Build Hierarchy Helper
    const buildHierarchy = (data: any[], type: 'regular' | 'fixed') => {
        const root: any = {
            id: type,
            name: type === 'fixed' ? '固定预算' : '常规预算',
            goal: 0,
            actual: 0,
            projects: {}
        }

        data.forEach(item => {
            const project = item.project || '未分类项目'
            const category = item.category || '未分类'
            
            // For Regular, prorate the goal
            const itemGoal = type === 'regular' ? getProratedGoal(item.goal) : item.goal
            
            if (!root.projects[project]) {
                root.projects[project] = { name: project, goal: 0, actual: 0, children: {} }
            }
            
            const proj = root.projects[project]
            
            if (!proj.children[category]) {
                proj.children[category] = { name: category, goal: 0, actual: 0, children: [] }
            }
            
            // Add leaf
            proj.children[category].children.push({ ...item, goal: itemGoal }) // Update leaf goal
            
            // Accumulate
            proj.children[category].goal += itemGoal
            proj.children[category].actual += item.actual
            proj.goal += itemGoal
            proj.actual += item.actual
            root.goal += itemGoal
            root.actual += item.actual
        })
        
        return root
    }

    const regularHierarchy = buildHierarchy(regularData, 'regular')
    const fixedHierarchy = buildHierarchy(fixedData, 'fixed')

    // ... (rest of helper functions) ...

    const toggleProject = (name: string) => {
        setExpandedProjects(prev => prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name])
    }
    
    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
    }

    const toggleCategory = (name: string) => {
        setExpandedCategories(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
    }

    const ProgressBar = ({ actual, goal, type }: { actual: number, goal: number, type: 'regular' | 'fixed' }) => {
        const percent = goal > 0 ? (actual / goal) * 100 : (actual > 0 ? 100 : 0)
        const balance = goal - actual
        const isOverspent = balance < 0
        const isCompleted = type === 'fixed' && actual > 0 // Fixed logic: Paid means "Completed" (or partially)
        
        // Theme Colors
        const theme = type === 'fixed' 
            ? { bg: 'bg-green-100', fill: 'bg-green-500', text: 'text-green-700' }
            : { bg: 'bg-blue-100', fill: 'bg-blue-500', text: 'text-blue-700' }
        
        if (isOverspent) {
            theme.fill = 'bg-red-500 animate-pulse' // Flashing for overspent
            theme.text = 'text-red-700'
        }

        return (
            <div className="flex items-center gap-4 w-full">
                <div className="flex-1 flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{formatMoney(actual)} / {formatMoney(goal)}</span>
                        <span className={isOverspent ? 'text-red-600 font-bold' : theme.text}>{percent.toFixed(1)}%</span>
                    </div>
                    <div className={`h-2.5 ${theme.bg} rounded-full overflow-hidden relative`}>
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${theme.fill}`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                        ></div>
                    </div>
                </div>
                
                {/* Balance Display */}
                <div className="w-[120px] flex flex-col items-end text-right group/tooltip relative">
                    <span className="text-xs text-gray-400">余额</span>
                    <span className={`text-sm font-bold ${isOverspent ? 'text-red-600' : 'text-gray-700'}`}>
                        {formatMoney(balance)}
                    </span>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        预算: {formatMoney(goal)} - 支出: {formatMoney(actual)} = {formatMoney(balance)}
                    </div>
                </div>

                {/* Fixed Icons */}
                {type === 'fixed' && (
                    <div className="w-6 flex justify-center">
                        {isOverspent ? (
                            <div title="已超支"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
                        ) : isCompleted ? (
                            <div title="已支出"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
                        ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-200" title="未支出"></div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    if (loading) return <div className="text-gray-400 text-center py-4">加载预算数据...</div>

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div 
                className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setIsModuleExpanded(!isModuleExpanded)}
            >
                <div className="flex items-center gap-2">
                    {isModuleExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                    <h3 className="text-lg font-bold text-gray-900">预算追踪</h3>
                </div>
                
                {/* Removed internal Time Selector */}
                <div className="text-sm text-gray-500">
                    {/* Optional: Show current period info here if needed */}
                </div>
            </div>
            
            {isModuleExpanded && (
                <div className="divide-y divide-gray-100">
                    {/* Regular Budget Section */}
                    <div className="bg-white">
                        <div 
                            className="p-4 bg-blue-50/50 flex items-center justify-between cursor-pointer select-none border-l-4 border-blue-500"
                            onClick={() => toggleGroup('regular')}
                        >
                            <div className="flex items-center gap-2">
                                {expandedGroups.includes('regular') ? <ChevronDown className="w-4 h-4 text-blue-900" /> : <ChevronRight className="w-4 h-4 text-blue-900" />}
                                <span className="font-bold text-blue-900">常规预算（按所选时间段统计）</span>
                            </div>
                            <div className="text-xs text-blue-600 font-medium">
                                总余额: {formatMoney(regularHierarchy.goal - regularHierarchy.actual)}
                            </div>
                        </div>
                        
                        {expandedGroups.includes('regular') && Object.values(regularHierarchy.projects).map((proj: any) => (
                            <div key={proj.name} className="border-t border-gray-100">
                                {/* ... (rest of rendering logic same as before) ... */}
                                <div 
                                    className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => toggleProject(proj.name)}
                                >
                                    <div className="flex items-center gap-2 pl-4 min-w-0 w-1/3">
                                        {expandedProjects.includes(proj.name) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                        <span className="font-semibold text-gray-900 truncate" title={proj.name}>{proj.name}</span>
                                    </div>
                                    <ProgressBar actual={proj.actual} goal={proj.goal} type="regular" />
                                </div>

                                {expandedProjects.includes(proj.name) && (
                                    <div className="bg-gray-50/30 border-t border-gray-100">
                                        {Object.values(proj.children).map((cat: any) => (
                                            <div key={cat.name}>
                                                <div 
                                                    className="py-3 px-4 pl-12 flex items-center justify-between hover:bg-gray-100 cursor-pointer transition-colors"
                                                    onClick={() => toggleCategory(`${proj.name}-${cat.name}`)}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 w-1/3">
                                                        {expandedCategories.includes(`${proj.name}-${cat.name}`) ? 
                                                            <ChevronDown className="w-3 h-3 text-gray-400" /> : 
                                                            <ChevronRight className="w-3 h-3 text-gray-400" />
                                                        }
                                                        <span className="text-sm font-medium text-gray-700 truncate" title={cat.name}>{cat.name}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <ProgressBar actual={cat.actual} goal={cat.goal} type="regular" />
                                                    </div>
                                                </div>

                                                {expandedCategories.includes(`${proj.name}-${cat.name}`) && (
                                                    <div className="bg-gray-100/50 border-t border-gray-100/50">
                                                        {cat.children.map((sub: any, idx: number) => (
                                                            <div key={idx} className="py-2 px-4 pl-20 flex items-center justify-between hover:bg-gray-100 transition-colors">
                                                                <span className="text-sm text-gray-500 w-1/3 truncate" title={sub.sub_category}>{sub.sub_category || '无子分类'}</span>
                                                                <div className="flex-1 opacity-90">
                                                                    <ProgressBar actual={sub.actual} goal={sub.goal} type="regular" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Fixed Budget Section */}
                    <div className="bg-white border-t-2 border-gray-100">
                        {/* ... (rest of fixed budget rendering same as before) ... */}
                        <div 
                            className="p-4 bg-green-50/50 flex items-center justify-between cursor-pointer select-none border-l-4 border-green-500"
                            onClick={() => toggleGroup('fixed')}
                        >
                            <div className="flex items-center gap-2">
                                {expandedGroups.includes('fixed') ? <ChevronDown className="w-4 h-4 text-green-900" /> : <ChevronRight className="w-4 h-4 text-green-900" />}
                                <span className="font-bold text-green-900">固定预算 (全年)</span>
                            </div>
                            <div className="text-xs text-green-600 font-medium">
                                总余额: {formatMoney(fixedHierarchy.goal - fixedHierarchy.actual)}
                            </div>
                        </div>

                        {expandedGroups.includes('fixed') && Object.values(fixedHierarchy.projects).map((proj: any) => (
                            <div key={proj.name} className="border-t border-gray-100">
                                <div 
                                    className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                                    onClick={() => toggleProject(`fixed-${proj.name}`)}
                                >
                                    <div className="flex items-center gap-2 pl-4 w-1/3">
                                        {expandedProjects.includes(`fixed-${proj.name}`) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                        <span className="font-semibold text-gray-900 truncate">{proj.name}</span>
                                    </div>
                                    <ProgressBar actual={proj.actual} goal={proj.goal} type="fixed" />
                                </div>

                                {expandedProjects.includes(`fixed-${proj.name}`) && (
                                    <div className="bg-gray-50/30 border-t border-gray-100">
                                        {Object.values(proj.children).map((cat: any) => (
                                            <div key={cat.name}>
                                                <div 
                                                    className="py-3 px-4 pl-12 flex items-center justify-between hover:bg-gray-100 cursor-pointer transition-colors"
                                                    onClick={() => toggleCategory(`fixed-${proj.name}-${cat.name}`)}
                                                >
                                                    <div className="flex items-center gap-2 w-1/3">
                                                        {expandedCategories.includes(`fixed-${proj.name}-${cat.name}`) ? 
                                                            <ChevronDown className="w-3 h-3 text-gray-400" /> : 
                                                            <ChevronRight className="w-3 h-3 text-gray-400" />
                                                        }
                                                        <span className="text-sm font-medium text-gray-700 truncate">{cat.name}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <ProgressBar actual={cat.actual} goal={cat.goal} type="fixed" />
                                                    </div>
                                                </div>

                                                {expandedCategories.includes(`fixed-${proj.name}-${cat.name}`) && (
                                                    <div className="bg-gray-100/50 border-t border-gray-100/50">
                                                        {cat.children.map((sub: any, idx: number) => (
                                                            <div key={idx} className="py-2 px-4 pl-20 flex items-center justify-between hover:bg-gray-100 transition-colors">
                                                                <span className="text-sm text-gray-500 w-1/3 truncate">{sub.sub_category || '无子分类'}</span>
                                                                <div className="flex-1 opacity-90">
                                                                    <ProgressBar actual={sub.actual} goal={sub.goal} type="fixed" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
