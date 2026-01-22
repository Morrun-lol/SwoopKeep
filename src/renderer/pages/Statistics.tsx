import { useState, useEffect } from 'react'
import { format, subMonths, subYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfDay, endOfDay } from 'date-fns'
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
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

const formatAmountShort = (amount: number) => {
  const n = Number(amount || 0)
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n)}`
}

const getTopN = (data: any[], n: number) => {
  const sorted = [...(data || [])].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
  return sorted.slice(0, Math.max(0, n))
}

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

  const pieTotal = pieData.reduce((sum, d) => sum + Number(d?.value || 0), 0)
  const topPie = getTopN(pieData, 8)

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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
              <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius="55%"
                              outerRadius="82%"
                              paddingAngle={2}
                              dataKey="value"
                              onClick={(data, _index, e) => {
                                  handlePieClick(data)
                                  if (e && (e as any).stopPropagation) (e as any).stopPropagation()
                              }}
                              cursor="pointer"
                              label={false}
                              labelLine={false}
                          >
                              {pieData.map((entry, index) => (
                                  <Cell 
                                      key={`cell-${index}`} 
                                      fill={COLORS[index % COLORS.length]} 
                                      strokeWidth={selectedCategory === entry.name ? 3 : 1}
                                      stroke={selectedCategory === entry.name ? '#111827' : '#ffffff'}
                                  />
                              ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: any, _name: any, props: any) => {
                              const label = props?.payload?.name ? `${props.payload.name}：` : ''
                              return `${label}¥${Number(value).toFixed(2)}`
                            }}
                          />
                      </PieChart>
                  </ResponsiveContainer>
              </div>

              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-900">Top 分类</div>
                  <div className="text-xs text-gray-500 font-mono">总计 ¥{pieTotal.toFixed(2)}</div>
                </div>

                <div className="space-y-2">
                  {topPie.map((item, idx) => {
                    const v = Number(item?.value || 0)
                    const pct = pieTotal > 0 ? (v / pieTotal) * 100 : 0
                    const active = selectedCategory === item.name
                    return (
                      <button
                        key={item.name || idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePieClick(item)
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                          active ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-sm flex-none"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                              <div className="text-xs text-gray-500 font-mono whitespace-nowrap">
                                {pct.toFixed(1)}% · ¥{formatAmountShort(v)}
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
                {selectedCategory ? `已选中: ${selectedCategory} (点击图表取消筛选)` : '点击图表扇区可筛选下方趋势图'}
            </p>
        </div>

        {/* Trend Chart */}
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
                    <LineChart
                      data={trendData}
                      margin={{ top: 16, right: 12, left: -12, bottom: 0 }}
                      onClick={(e: any) => {
                        const date = e?.activePayload?.[0]?.payload?.date
                        if (!date) {
                          setSelectedPoint(null)
                          return
                        }
                        setSelectedPoint({ date, dimension: trendDimension })
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickMargin={6}
                        interval="preserveStartEnd"
                        tickFormatter={(value) => {
                          if (typeof value === 'string' && value.includes('-')) {
                            const parts = value.split('-')
                            if (parts.length === 3) return `${parts[1]}-${parts[2]}`
                          }
                          return value
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        width={36}
                        tickFormatter={(v) => formatAmountShort(Number(v))}
                      />
                      <RechartsTooltip
                        cursor={{ stroke: 'rgba(16,185,129,0.35)', strokeWidth: 2 }}
                        formatter={(value: any) => `¥${Number(value).toFixed(2)}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                      />
                    </LineChart>
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
