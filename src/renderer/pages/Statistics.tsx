import { useState, useEffect } from 'react'
import { format, subMonths, subYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfDay, endOfDay } from 'date-fns'
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import ExpenseDetailTable from '../components/ExpenseDetailTable'

type TimePeriod = 'week' | 'month' | 'quarter' | 'year' | 'custom'
type Dimension = 'day' | 'week' | 'month' | 'quarter' | 'year'

// Low saturation "Morandi" colors
const COLORS = [
  '#9CA3AF', // Gray
  '#F87171', // Red
  '#FB923C', // Orange
  '#FBBF24', // Amber
  '#A3E635', // Lime
  '#34D399', // Emerald
  '#22D3EE', // Cyan
  '#818CF8', // Indigo
  '#A78BFA', // Violet
  '#F472B6', // Pink
]

export default function Statistics(props?: { 
  externalTimePeriod?: TimePeriod, 
  externalDateRange?: { start: string, end: string },
  dateRange?: { start: string, end: string },
  onChartClick?: (date: string, category?: string) => void
}) {
  const { externalTimePeriod, externalDateRange, dateRange, onChartClick } = props || {}
  
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  
  // Sync with external props if provided
  useEffect(() => {
      if (externalTimePeriod) setTimePeriod(externalTimePeriod)
  }, [externalTimePeriod])

  useEffect(() => {
      if (externalDateRange) setCustomDateRange(externalDateRange)
  }, [externalDateRange])

  const [trendDimension, setTrendDimension] = useState<Dimension>('day')
  
  const [pieData, setPieData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<{ date: string, dimension: Dimension } | null>(null)
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    setSelectedPoint(null) // Reset detail view when filters change
  }, [timePeriod, customDateRange, trendDimension, selectedCategory, dateRange?.start, dateRange?.end]) // Added dateRange dependency

  const getDateRange = () => {
    // If dateRange is provided via props (e.g. from Home), use it directly
    if (dateRange) {
        return dateRange
    }

    const now = new Date()
    switch (timePeriod) {
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
          start: customDateRange.start || format(startOfMonth(now), 'yyyy-MM-dd'),
          end: customDateRange.end || format(endOfMonth(now), 'yyyy-MM-dd')
        }
      default:
        // For 'day' or other unhandled types from parent, fallback to day range
        // If timePeriod is passed as 'day' (which isn't in TimePeriod type locally but might come from parent)
        if (timePeriod === ('day' as any)) {
             return {
                start: format(startOfDay(now), 'yyyy-MM-dd'),
                end: format(endOfDay(now), 'yyyy-MM-dd')
            }
        }
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
        
        // 1. Get Pie Chart Data (Expense Composition)
        // If selectedCategory is set, we could drill down, but here we keep top-level categories
        // or we could show sub-categories if a category is selected?
        // Requirement: "当用户在支出构成圆饼图点击某一个构成时，该联动的指出趋势折线图就会显示对应支出构成的二级分类既“子分类”的数据"
        // Wait, requirement says: click Pie -> Line chart shows data for that category (or sub-categories?).
        // Actually, let's keep Pie chart as Category composition.
        
        const compositionData = await window.api.getExpenseComposition(start, end, 'category')
        setPieData(compositionData)
        
        // 2. Get Trend Data
        // If selectedCategory is set, filter by that category
        const filter = selectedCategory ? { type: 'category', value: selectedCategory } : undefined
        const trend = await window.api.getExpenseTrend(start, end, trendDimension, filter)
        setTrendData(trend)
        
    } catch (error) {
        console.error('Failed to load statistics data:', error)
    } finally {
        setLoading(false)
    }
  }

  const handlePieClick = (data: any) => {
    // Toggle selection
    if (selectedCategory === data.name) {
        setSelectedCategory(null)
    } else {
        setSelectedCategory(data.name)
    }
  }

  // 渲染部分调整：隐藏筛选栏（如果外部控制），调整布局为上下分行
  if (loading && !pieData.length && !trendData.length) return <div className="p-8 text-center text-gray-400">加载中...</div>

    return (
    <div className="space-y-6">
      {/* 如果没有外部传入 timePeriod，显示筛选栏 */}
      {!externalTimePeriod && !dateRange && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
                {(['week', 'month', 'quarter', 'year'] as TimePeriod[]).map(p => (
                    <button
                        key={p}
                        onClick={() => setTimePeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            timePeriod === p 
                            ? 'bg-gray-900 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {p === 'week' ? '本周' : p === 'month' ? '本月' : p === 'quarter' ? '本季' : '本年'}
                    </button>
                ))}
            </div>
            {timePeriod === 'custom' && (
                <div className="flex gap-2 text-sm">
                    <input type="date" className="border rounded px-2 py-1" 
                        onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})} />
                    <span>-</span>
                    <input type="date" className="border rounded px-2 py-1"
                        onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})} />
                </div>
            )}
          </div>
      )}

      {/* Charts Section: Modified to single column layout (Stacked) */}
      <div className="grid grid-cols-1 gap-6">
        {/* Pie Chart */}
        <div 
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]"
            onClick={(e) => {
                // Check if click target is NOT a pie sector path
                // This is a bit tricky with Recharts. 
                // Easier way: Recharts wrapper doesn't easily expose background click.
                // But we can check if the click target classList contains 'recharts-surface' or wrapper.
                // Or simpler: handlePieClick handles toggle.
                // To support "click any blank area to cancel", we can add a global click listener on this container?
                // But handlePieClick stops propagation? Recharts onClick might not propagate DOM event same way.
                
                // Let's rely on Recharts onClick for sectors, and this div onClick for background.
                // BUT, Recharts onClick events bubble up?
                // If I click a sector, handlePieClick fires. 
                // If I click background, this fires.
                // We need to stop propagation in handlePieClick? Recharts doesn't pass DOM event usually.
                
                // Alternative: Check if we are clicking SVG background.
                // Requirement: "点击任意空白处取消筛选"
                
                // Let's try: if selectedCategory is not null, and we clicked here (and not on a sector handled by Pie onClick), clear it.
                // But we don't know if Pie onClick fired first.
                // Actually, if we click background, Pie onClick won't fire.
                // So if we click here, we can just clear? 
                // But if we click Pie sector, this also fires (bubbling).
                // So we need to know if a sector was clicked.
                
                // Actually, let's just add a "Clear Filter" button/text overlay if that's safer,
                // OR implement "click outside pie" logic.
                
                // Let's check e.target. If it's the SVG or container, clear.
                // If it's a path (sector), don't clear (handled by Pie).
                const target = e.target as HTMLElement
                if (target.tagName !== 'path' && selectedCategory) {
                    setSelectedCategory(null)
                }
            }}
        >
            <h3 className="text-lg font-bold text-gray-900 mb-4">支出构成</h3>
            <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius="40%"
                            outerRadius="70%"
                            paddingAngle={5}
                            dataKey="value"
                            onClick={(data, index, e) => {
                                // Stop propagation to container if possible, but Recharts event is synthetic.
                                // But data click handler runs.
                                // If we just toggle here, and container also runs...
                                // Container check for 'path' tag should work.
                                handlePieClick(data)
                                if (e && e.stopPropagation) e.stopPropagation();
                            }}
                            cursor="pointer"
                            label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            // Make label font smaller (Requirement 2)
                            style={{ fontSize: '12px' }} 
                            labelLine={false}
                        >
                            {pieData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={COLORS[index % COLORS.length]} 
                                    strokeWidth={selectedCategory === entry.name ? 3 : 0}
                                    stroke="#000"
                                />
                            ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => `¥${Number(value).toFixed(2)}`} />
                        {/* 缩小 Legend 字体 */}
                        <Legend wrapperStyle={{ fontSize: '12px' }} /> 
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
                {selectedCategory ? `已选中: ${selectedCategory} (点击图表取消筛选)` : '点击图表扇区可筛选下方趋势图'}
            </p>
        </div>

        {/* Line Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                    {selectedCategory ? `${selectedCategory} - 支出趋势` : '总支出趋势'}
                </h3>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {(['day', 'week', 'month', 'quarter'] as Dimension[]).map(d => (
                        <button
                            key={d}
                            onClick={() => setTrendDimension(d)}
                            className={`px-2 py-1 text-xs rounded-md transition-all ${
                                trendDimension === d 
                                ? 'bg-white text-emerald-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {d === 'day' ? '日' : d === 'week' ? '周' : d === 'month' ? '月' : '季'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={trendData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(e) => {
                            if (!e || !(e as any).activePayload) {
                                setSelectedPoint(null)
                            }
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            tick={{fontSize: 10}} 
                            tickMargin={5}
                            interval="preserveStartEnd"
                            tickFormatter={(value) => {
                                // Shorten dates for mobile readability
                                if (typeof value === 'string' && value.includes('-')) {
                                    const parts = value.split('-')
                                    // YYYY-MM-DD -> MM-DD
                                    if (parts.length === 3) return `${parts[1]}-${parts[2]}`
                                    // YYYY-MM -> YYYY-MM (keep)
                                }
                                return value
                            }}
                        />
                        <YAxis 
                            tick={{fontSize: 10}} 
                            width={30}
                        />
                        <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                        <Bar 
                            dataKey="amount" 
                            fill="#10B981" 
                            radius={[4, 4, 0, 0]}
                            cursor="pointer"
                            maxBarSize={40}
                            onClick={(data, index, e) => {
                                // data is the payload itself in Bar onClick
                                const payload = data as any
                                if (payload && payload.date) {
                                    console.log('Bar clicked:', payload)
                                    setSelectedPoint({ date: payload.date, dimension: trendDimension })
                                    // Stop propagation to prevent chart onClick from clearing it immediately?
                                    // Recharts custom events don't always support stopPropagation on the synthetic event same way.
                                    // But let's try.
                                    if (e && e.stopPropagation) e.stopPropagation();
                                }
                            }}
                        >
                            {trendData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={selectedPoint && selectedPoint.date === entry.date ? '#F59E0B' : '#10B981'} 
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Hint text moved below chart */}
            {selectedPoint && (
                <div className="text-center text-xs text-gray-400 italic mt-[-10px] pb-2">
                    点击趋势图空白处可返回
                </div>
            )}
        </div>

        {/* Expense Detail Table (Linked Module) */}
        <ExpenseDetailTable 
            filter={selectedPoint ? {
                date: selectedPoint.date,
                dimension: selectedPoint.dimension,
                category: selectedCategory
            } : undefined}
            
            // Fallback props if no point selected
            startDate={!selectedPoint ? getDateRange().start : undefined}
            endDate={!selectedPoint ? getDateRange().end : undefined}
            title={!selectedPoint ? (selectedCategory ? `${selectedCategory} - 全部记录` : '当前时间段全部记录') : undefined}
            category={selectedCategory}
            onClear={() => setSelectedPoint(null)}
        />
      </div>
    </div>
  )
}
