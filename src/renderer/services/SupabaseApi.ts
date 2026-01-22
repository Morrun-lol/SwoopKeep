
import { ExpenseApi } from './ApiInterface'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { loadRuntimeConfig } from '../lib/runtimeConfig'

const isInitialized = () => !!supabase

const getApiBaseUrl = () => {
  const cfg = loadRuntimeConfig()
  const raw = ((cfg.apiBaseUrl || '') || (import.meta.env.VITE_API_BASE_URL || '')).trim()
  const loc = typeof window !== 'undefined' ? window.location : null
  const guessed = loc ? `${loc.protocol}//${loc.hostname}:3001` : ''

  let resolved = raw || guessed
  try {
    const u = new URL(resolved)
    if (loc && (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && loc.hostname && loc.hostname !== u.hostname) {
      u.hostname = loc.hostname
      resolved = u.toString()
    }
  } catch {
  }

  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved
}

const fetchJsonWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const json = await res.json().catch(() => null)
    return { res, json }
  } finally {
    clearTimeout(t)
  }
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const parseYmd = (dateStr: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr)
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatYmd = (date: Date) => {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

const startOfWeekMonday = (date: Date) => {
  const day = date.getDay()
  const diff = (day + 6) % 7
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - diff)
  return d
}

const startOfMonthDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

const startOfQuarterDate = (date: Date) => {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3
  return new Date(date.getFullYear(), quarterMonth, 1)
}

const startOfYearDate = (date: Date) => new Date(date.getFullYear(), 0, 1)

export class SupabaseApi implements ExpenseApi {

  async ensureDefaults(): Promise<void> {
    if (!isInitialized()) return
    try {
      const { data: families } = await supabase!
        .from('families')
        .select('*')
        .limit(1)

      let familyId = families?.[0]?.id
      if (!familyId) {
        const { data: created } = await supabase!
          .from('families')
          .insert({ name: '默认家庭组' })
          .select()
          .single()
        familyId = created?.id
      }

      if (familyId) {
        const { data: members } = await supabase!
          .from('members')
          .select('id')
          .eq('family_id', familyId)
          .eq('name', '我')
          .limit(1)

        if (!members || members.length === 0) {
          await supabase!.from('members').insert({ name: '我', family_id: familyId })
        }
      }
    } catch {
      return
    }
  }
    
  async transcribeAudio(buffer: ArrayBuffer): Promise<string> {
    const baseUrl = getApiBaseUrl()
    if (!baseUrl) throw new Error('未配置语音识别服务地址：请设置 VITE_API_BASE_URL')

    try {
      const { res, json } = await fetchJsonWithTimeout(
        `${baseUrl}/api/ai/transcribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: arrayBufferToBase64(buffer),
            mimeType: 'audio/wav',
            fileName: 'audio.wav',
            language: 'zh',
          }),
        },
        30000,
      )

      if (!res.ok) {
        const message = json?.error || '语音识别失败'
        throw new Error(message)
      }

      if (!json?.success || typeof json.text !== 'string') {
        throw new Error(json?.error || '语音识别失败')
      }

      return json.text
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('语音识别超时，请检查网络后重试')
      if (String(e?.message || '').includes('Failed to fetch')) {
        throw new Error(`无法连接语音识别服务（${baseUrl}）。请确认服务已启动且手机/浏览器可访问。`)
      }
      throw e
    }
  }

  async transcribeAudioViaWebSocket(buffer: ArrayBuffer): Promise<string> {
       return this.transcribeAudio(buffer)
  }

  async parseExpense(text: string, context?: any): Promise<any> {
    const baseUrl = getApiBaseUrl()
    if (!baseUrl) throw new Error('未配置语义解析服务地址：请设置 VITE_API_BASE_URL')

    const hierarchy = Array.isArray(context?.hierarchy)
      ? context.hierarchy
          .map((i: any) => `${(i?.project || '无项目').toString()}>${(i?.category || '').toString()}>${(i?.sub_category || '无子分类').toString()}`)
          .slice(0, 120)
      : []

    const memberNames = Array.isArray(context?.members)
      ? context.members.map((m: any) => (m?.name || '').toString()).filter(Boolean).slice(0, 50)
      : []

    try {
      const { res, json } = await fetchJsonWithTimeout(
        `${baseUrl}/api/ai/parse-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, context: { hierarchy, members: memberNames } }),
        },
        20000,
      )

      if (!res.ok) {
        const message = json?.error || '语义解析失败'
        throw new Error(message)
      }

      const hasExpenses = Array.isArray(json?.expenses)
      const hasData = !!json?.data
      if (!json?.success || (!hasExpenses && !hasData)) {
        const message = json?.error || '语义解析失败'
        throw new Error(message)
      }

      const list = Array.isArray(json?.expenses)
        ? json.expenses
        : (json?.data ? [json.data] : [])

      const normalized = list.map((data: any) => ({
        project: data?.project || '日常开支',
        category: data?.category || '其他',
        sub_category: data?.sub_category || '其他',
        amount: data?.amount,
        expense_date: data?.expense_date,
        description: data?.description,
        member_name: data?.member_name,
        member_id: data?.member_id,
        missing_info: data?.missing_info || [],
      }))

      return {
        expenses: normalized,
        provider: json.provider || 'unknown',
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error('语义解析超时，请检查网络后重试')
      if (String(e?.message || '').includes('Failed to fetch')) {
        throw new Error(`无法连接语义解析服务（${baseUrl}）。请确认服务已启动且手机/浏览器可访问。`)
      }
      throw e
    }
  }

  async checkLLMConnection(): Promise<boolean> {
    const baseUrl = getApiBaseUrl()
    try {
      const response = await fetch(`${baseUrl}/api/ai/health`)
      if (!response.ok) return false
      const payload = await response.json()
      return !!payload?.openaiConfigured
    } catch {
      return false
    }
  }

  async testiFlytekConnection(): Promise<{ success: boolean; message: string; logs: string[] }> {
    return { success: true, message: 'Ready', logs: [] }
  }

  async createExpense(data: any): Promise<number> {
    if (!isInitialized()) return 0
    const { data: res, error } = await supabase!
        .from('expense_records')
        .insert([data])
        .select()
        .single()
    
    if (error) {
        console.error('createExpense error', error)
        return 0
    }
    return res.id
  }

  async getMonthlyBudgets(year: number, month: number): Promise<any[]> {
    if (!isInitialized()) return []
    const { data } = await supabase!
      .from('monthly_budgets')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('project', { ascending: true })
      .order('category', { ascending: true })
      .order('sub_category', { ascending: true })

    return data || []
  }

  async saveMonthlyBudget(budget: any): Promise<boolean> {
    if (!isInitialized()) return false
    const payload = {
      project: (budget?.project ?? '').toString(),
      category: (budget?.category ?? '').toString(),
      sub_category: (budget?.sub_category ?? '').toString(),
      budget_amount: Number(budget?.budget_amount ?? 0),
      year: Number(budget?.year),
      month: Number(budget?.month),
    }

    const { error } = await supabase!
      .from('monthly_budgets')
      .upsert(payload, { onConflict: 'user_id, project, category, sub_category, year, month' })

    return !error
  }

  async deleteMonthlyBudget(id: number): Promise<boolean> {
    if (!isInitialized()) return false
    const { error } = await supabase!.from('monthly_budgets').delete().eq('id', id)
    return !error
  }

  async getExpensesByDateRange(startDate: string, endDate: string): Promise<any[]> {
    if (!isInitialized()) return []
    const { data, error } = await supabase!
        .from('expense_records')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })
    
    return data || []
  }

  async getExpenseById(id: number): Promise<any | undefined> {
    if (!isInitialized()) return undefined
    const { data } = await supabase!
        .from('expense_records')
        .select('*')
        .eq('id', id)
        .single()
    return data
  }

  async updateExpense(id: number, data: any): Promise<boolean> {
    if (!isInitialized()) return false
    const { error } = await supabase!
        .from('expense_records')
        .update(data)
        .eq('id', id)
    return !error
  }

  async deleteExpense(id: number): Promise<boolean> {
    if (!isInitialized()) return false
    const { error } = await supabase!
        .from('expense_records')
        .delete()
        .eq('id', id)
    return !error
  }

  async getAllCategories(): Promise<any[]> {
    if (!isInitialized()) {
        return [
          { name: '餐饮', icon: '🍽️', color: '#EF4444' },
          { name: '交通', icon: '🚗', color: '#3B82F6' },
          // ...
        ]
    }
    const { data } = await supabase!.from('expense_categories').select('*')
    if (!data || data.length === 0) {
        // Return defaults if empty
        return [
          { name: '餐饮', icon: '🍽️', color: '#EF4444' },
          { name: '交通', icon: '🚗', color: '#3B82F6' },
          { name: '购物', icon: '🛍️', color: '#8B5CF6' },
          { name: '娱乐', icon: '🎬', color: '#F59E0B' },
          { name: '医疗', icon: '🏥', color: '#10B981' },
          { name: '教育', icon: '📚', color: '#6366F1' },
          { name: '住房', icon: '🏠', color: '#EC4899' },
          { name: '其他', icon: '📦', color: '#6B7280' }
        ]
    }
    return data
  }

  async getStatisticsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    const expenses = await this.getExpensesByDateRange(startDate, endDate)
    const map = new Map<string, number>()
    expenses.forEach(e => {
        const current = map.get(e.category) || 0
        map.set(e.category, current + e.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }

  async getDailyStatistics(startDate: string, endDate: string): Promise<any[]> {
    const expenses = await this.getExpensesByDateRange(startDate, endDate)
    const map = new Map<string, number>()
    expenses.forEach(e => {
        const date = e.expense_date
        const current = map.get(date) || 0
        map.set(date, current + e.amount)
    })
    return Array.from(map.entries()).map(([date, amount]) => ({ date, amount })).sort((a,b) => a.date.localeCompare(b.date))
  }

  async getTotalAmountByDateRange(startDate: string, endDate: string, memberId?: number): Promise<{ total_amount: number; total_count: number }> {
    let query = supabase!
        .from('expense_records')
        .select('amount', { count: 'exact' })
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
    
    if (memberId) query = query.eq('member_id', memberId)
    
    const { data, count } = await query
    
    const total = data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
    return { total_amount: total, total_count: count || 0 }
  }

  async getMonthlyStatistics(year: number, month: number): Promise<any> {
    const strMonth = month.toString().padStart(2, '0')
    const startDate = `${year}-${strMonth}-01`
    const endDate = `${year}-${strMonth}-31`
    return this.getStatisticsByDateRange(startDate, endDate)
  }

  async getRecentExpenses(limit: number = 20, memberId?: number): Promise<any[]> {
    if (!isInitialized()) return []
    let query = supabase!
        .from('expense_records')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
        
    if (memberId) query = query.eq('member_id', memberId)
    
    const { data } = await query
    return data || []
  }

  async searchExpenses(keyword: string): Promise<any[]> {
    if (!isInitialized()) return []
    const { data } = await supabase!
        .from('expense_records')
        .select('*')
        .ilike('description', `%${keyword}%`)
    return data || []
  }

  async checkNetworkStatus(): Promise<any> {
    // Mock network status check
    return { 
        baidu: true,
        google: true,
        openai: true,
        gemini: true
    }
  }

  async downloadTemplate(): Promise<boolean> {
      try {
          const data = [
            ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注'],
            ['我', '餐饮', '一日三餐', '午餐', new Date().toISOString().split('T')[0], 35.5, '牛肉面'],
            ['默认家庭组', '交通', '公共交通', '地铁', new Date().toISOString().split('T')[0], 5.0, '上班通勤']
          ]
          const ws = XLSX.utils.aoa_to_sheet(data)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, "模板")
          
          XLSX.writeFile(wb, "记账模板.xlsx")
          return true
      } catch (e) {
          console.error('Download template failed', e)
          return false
      }
  }

  async downloadBudgetTemplate(): Promise<boolean> {
      try {
          const data = [
            ['费用类型', '项目 (一级)', '分类 (二级)', '子分类 (三级)', '年度预算金额'],
            ['常规费用', '日常开销', '餐饮', '早餐', 5000],
            ['固定费用', '固定支出', '房租', '', 36000]
          ]
          const ws = XLSX.utils.aoa_to_sheet(data)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, "预算模板")
          
          XLSX.writeFile(wb, "预算目标模板.xlsx")
          return true
      } catch (e) {
          console.error('Download budget template failed', e)
          return false
      }
  }

  async importExcel(buffer: ArrayBuffer, fileName?: string): Promise<{ success: number; failed: number, skipped?: number, importId?: number, errors?: { rowNumber: number, message: string }[] }> {
      if (!isInitialized()) return { success: 0, failed: 0 }
      
      try {
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (data.length < 2) return { success: 0, failed: 0 }

        const header = data[0]
        const requiredHeader = ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注']
        const oldHeader = ['项目', '分类', '子分类', '日期', '金额', '备注']
        const headerStr = (header || []).slice(0, 7).map((v: any) => String(v ?? '').trim())
        const isNew = JSON.stringify(headerStr.slice(0, 7)) === JSON.stringify(requiredHeader)
        const isOld = JSON.stringify(headerStr.slice(0, 6)) === JSON.stringify(oldHeader)
        if (!isNew && !isOld) {
          return {
            success: 0,
            failed: data.length - 1,
            errors: [{ rowNumber: 1, message: `表头格式错误。请下载最新模板，确保表头包含：${requiredHeader.join(', ')}` }],
          }
        }

        let successCount = 0
        let failedCount = 0
        let skippedCount = 0
        const errors: { rowNumber: number, message: string }[] = []
        
        // 1. Get Families and Members Cache
        const families = await this.getAllFamilies()
        let defaultFamilyId = 0
        if (families.length === 0) {
            defaultFamilyId = await this.createFamily('默认家庭组')
        } else {
            defaultFamilyId = families[0].id
        }
        
        const members = await this.getAllMembers()

        // 2. Create Import History Record
        const { data: importHistory } = await supabase!
            .from('import_history')
            .insert({
                file_name: fileName || `Import_${new Date().toISOString()}`,
                import_type: 'expense',
                record_count: 0 
            })
            .select()
            .single()
        
        const importId = importHistory?.id || 0

        // 3. Process Rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i]
            if (!row || row.length === 0) continue

            try {
                let memberName, project, category, subCategory, rawDate, amount, note
                
                if (isNew) {
                    [memberName, project, category, subCategory, rawDate, amount, note] = row
                } else {
                    [project, category, subCategory, rawDate, amount, note] = row
                }

                // Member Logic
                let memberId = null
                if (memberName) {
                    const nameStr = String(memberName).trim()
                    let member = members.find(m => m.name === nameStr)
                    if (!member) {
                        const newId = await this.createMember(nameStr, defaultFamilyId)
                        member = { id: newId, name: nameStr, family_id: defaultFamilyId }
                        members.push(member)
                    }
                    memberId = member.id
                }

                if (!amount || isNaN(Number(amount))) {
                    failedCount++
                    errors.push({ rowNumber: i + 1, message: '金额无效' })
                    continue
                }

                // Date Parsing
                let dateStr = ''
                if (typeof rawDate === 'number') {
                    const date = new Date((rawDate - 25569) * 86400 * 1000)
                    dateStr = date.toISOString().split('T')[0]
                } else {
                    dateStr = String(rawDate || '').trim()
                }

                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    failedCount++
                    errors.push({ rowNumber: i + 1, message: '日期无效，请使用 YYYY-MM-DD 或 Excel 日期格式' })
                    continue
                }

                const finalCategory = category || '其他'
                
                // Check duplicate (Simple check)
                const { data: existing } = await supabase!
                    .from('expense_records')
                    .select('id')
                    .eq('expense_date', dateStr)
                    .eq('amount', Number(amount))
                    .eq('category', String(finalCategory))
                    .eq('description', note || '')
                    .maybeSingle()
                
                if (existing) {
                    skippedCount++
                    continue
                }

                await this.createExpense({
                    project: project ? String(project) : undefined,
                    category: String(finalCategory),
                    sub_category: subCategory ? String(subCategory) : undefined,
                    amount: Number(amount),
                    expense_date: dateStr,
                    description: note || '',
                    member_id: memberId || undefined,
                    import_id: importId
                })
                successCount++
            } catch (e) {
                console.error(`Row ${i} failed`, e)
                failedCount++
                errors.push({ rowNumber: i + 1, message: (e as any)?.message || '导入失败' })
            }
        }

        // Update history count
        if (importId) {
            await supabase!
                .from('import_history')
                .update({ record_count: successCount })
                .eq('id', importId)
        }

        return { success: successCount, failed: failedCount, skipped: skippedCount, importId, errors }

      } catch (e) {
          console.error('Import failed', e)
          return { success: 0, failed: 0, errors: [{ rowNumber: 0, message: (e as any)?.message || '导入失败' }] }
      }
  }

  async getExpenseComposition(startDate: string, endDate: string, level?: string, parentValue?: string): Promise<any[]> {
     const expenses = await this.getExpensesByDateRange(startDate, endDate)
     // Client-side aggregation
     const map = new Map<string, number>()
     expenses.forEach(e => {
         const mode = level || 'category'
         if (mode === 'sub_category') {
           if (parentValue && e.category !== parentValue) return
           const key = (e.sub_category || '').trim() || '其他'
           const current = map.get(key) || 0
           map.set(key, current + (e.amount || 0))
           return
         }

         if (mode === 'project') {
           const key = (e.project || '').trim() || '无项目'
           const current = map.get(key) || 0
           map.set(key, current + (e.amount || 0))
           return
         }

         const key = (e.category || '').trim() || '其他'
         const current = map.get(key) || 0
         map.set(key, current + (e.amount || 0))
     })
     return Array.from(map.entries())
       .map(([name, value]) => ({ name, value }))
       .sort((a, b) => b.value - a.value)
  }

  async getExpenseTrend(startDate: string, endDate: string, dimension?: string, filter?: any): Promise<any[]> {
     const expenses = await this.getExpensesByDateRange(startDate, endDate)
     const bucket = (dateStr: string) => {
       const date = parseYmd(dateStr)
       if (dimension === 'week') return formatYmd(startOfWeekMonday(date))
       if (dimension === 'month') return formatYmd(startOfMonthDate(date))
       if (dimension === 'quarter') return formatYmd(startOfQuarterDate(date))
       if (dimension === 'year') return formatYmd(startOfYearDate(date))
       return dateStr
     }

     const filtered = expenses.filter((e) => {
       if (!filter) return true
       if (filter.type === 'category') return e.category === filter.value
       if (filter.type === 'sub_category') return e.sub_category === filter.value
       if (filter.type === 'project') return (e.project || '') === filter.value
       return true
     })

     const map = new Map<string, number>()
     filtered.forEach((e) => {
       const key = bucket(e.expense_date)
       const current = map.get(key) || 0
       map.set(key, current + (e.amount || 0))
     })

     return Array.from(map.entries())
       .map(([date, amount]) => ({ date, amount }))
       .sort((a, b) => a.date.localeCompare(b.date))
  }

  async getYearGoals(year: number, memberId?: number): Promise<any[]> {
      if (!isInitialized()) return []
      let query = supabase!
        .from('year_goals')
        .select('*')
        .eq('year', year)
      
      if (memberId !== undefined) query = query.eq('member_id', memberId)
      const { data } = await query
      return data || []
  }

  async saveYearGoal(goal: any): Promise<any[]> {
      if (!isInitialized()) return []
      const payload = {
        year: Number(goal?.year),
        project: (goal?.project ?? '').toString(),
        category: (goal?.category ?? '').toString(),
        sub_category: (goal?.sub_category ?? '').toString(),
        goal_amount: Number(goal?.goal_amount ?? 0),
        expense_type: (goal?.expense_type ?? '常规费用').toString(),
        member_id: Number(goal?.member_id ?? 0),
      }
      const { error } = await supabase!
        .from('year_goals')
        .upsert(payload, { onConflict: 'user_id, year, project, category, sub_category, member_id' })
      if (error) throw error

      const memberId = goal?.member_id !== undefined ? Number(goal.member_id) : undefined
      return this.getYearGoals(payload.year, memberId)
  }

  async getGoalComparison(year: number, startDate?: string, endDate?: string, memberId?: number): Promise<any[]> {
      if (!isInitialized()) return []
      const goals = await this.getYearGoals(year, memberId)
      const expenses = await this.getExpensesByDateRange(startDate || `${year}-01-01`, endDate || `${year}-12-31`)
      
      const result = goals.map(g => {
          const match = expenses.filter(e => 
              (!g.project || e.project === g.project) &&
              (!g.category || e.category === g.category) &&
              (!g.sub_category || e.sub_category === g.sub_category) &&
              (!memberId || e.member_id === memberId)
          )
          const actual = match.reduce((sum, e) => sum + e.amount, 0)
          return {
              ...g,
              goal: g.goal_amount,
              actual: actual
          }
      })
      return result
  }

  async clearAllData(): Promise<boolean> {
      if (!isInitialized()) return false
      // Truncate/Delete all
      await supabase!.from('expense_records').delete().neq('id', 0)
      await supabase!.from('year_goals').delete().neq('id', 0)
      await supabase!.from('monthly_budgets').delete().neq('id', 0)
      return true
  }

  async getExpenseStructure(): Promise<{ project: string; category: string; sub_category: string }[]> {
      if (!isInitialized()) return []
      const { data } = await supabase!.from('expense_hierarchy').select('*')
      return data || []
  }

  async recognizeImage(buffer: ArrayBuffer): Promise<{ text: string; provider: string }> {
      const baseUrl = getApiBaseUrl()
      try {
        const response = await fetch(`${baseUrl}/api/ai/recognize-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: arrayBufferToBase64(buffer),
            mimeType: 'image/jpeg',
          }),
        })

        if (!response.ok) {
          throw new Error('Image recognition failed')
        }

        const payload = await response.json()
        if (!payload?.success || typeof payload.text !== 'string') {
          throw new Error('Image recognition failed')
        }

        return { text: payload.text, provider: 'openai' }
      } catch {
        return { text: 'Image recognition unavailable', provider: 'none' }
      }
  }

  async importBudgetGoals(buffer: ArrayBuffer, year: number, memberId?: number): Promise<{ success: number; failed: number }> {
      if (!isInitialized()) return { success: 0, failed: 0 }
      try {
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (data.length < 2) return { success: 0, failed: 0 }

        // Find header map
        const headers = data[0]
        const map: any = {}
        headers.forEach((h: any, i: number) => {
             if (typeof h === 'string') {
                if (h.includes('费用类型')) map['type'] = i
                else if (h.includes('项目')) map['project'] = i
                else if (h.includes('分类') && !h.includes('子')) map['category'] = i
                else if (h.includes('子分类')) map['sub'] = i
                else if (h.includes('预算') || h.includes('金额')) map['amount'] = i
             }
        })

        if (map['category'] === undefined || map['amount'] === undefined) {
             return { success: 0, failed: data.length - 1 }
        }

        let successCount = 0
        let failedCount = 0

        for (let i = 1; i < data.length; i++) {
             const row = data[i]
             if (!row || row.length === 0) continue
             
             try {
                 await this.saveYearGoal({
                     year,
                     member_id: memberId,
                     expense_type: map['type'] !== undefined ? (row[map['type']] || '常规费用') : '常规费用',
                     project: map['project'] !== undefined ? (row[map['project']] || '') : '',
                     category: String(row[map['category']]),
                     sub_category: map['sub'] !== undefined ? (row[map['sub']] || '') : '',
                     goal_amount: Number(row[map['amount']] || 0)
                 })
                 successCount++
             } catch (e) {
                 failedCount++
             }
        }
        return { success: successCount, failed: failedCount }
      } catch (e) {
          return { success: 0, failed: 0 }
      }
  }

  async getImportHistory(): Promise<any[]> {
      if (!isInitialized()) return []
      const { data } = await supabase!.from('import_history').select('*').order('import_date', { ascending: false })
      return data || []
  }

  async deleteImportRecord(id: number): Promise<boolean> {
      if (!isInitialized()) return false
      // 1. Delete related expenses? 
      // Supabase doesn't cascade delete on logical link unless foreign key.
      // But we have import_id in expense_records.
      await supabase!.from('expense_records').delete().eq('import_id', id)
      await supabase!.from('import_history').delete().eq('id', id)
      return true
  }

  async cleanDuplicateData(): Promise<number> {
      if (!isInitialized()) return 0
      
      // Client-side duplicate cleaning
      const { data: allExpenses } = await supabase!
        .from('expense_records')
        .select('id, expense_date, amount, category, description, project, sub_category, member_id')
        .order('expense_date', { ascending: true })
      
      if (!allExpenses || allExpenses.length === 0) return 0

      const seen = new Set<string>()
      const duplicates: number[] = []

      for (const e of allExpenses) {
          const key = `${e.expense_date}|${e.amount}|${e.category}|${e.description}|${e.project}|${e.sub_category}|${e.member_id}`
          if (seen.has(key)) {
              duplicates.push(e.id)
          } else {
              seen.add(key)
          }
      }

      if (duplicates.length > 0) {
          await supabase!.from('expense_records').delete().in('id', duplicates)
      }

      return duplicates.length
  }

  async deleteYearGoal(id: number, year: number, memberId?: number): Promise<any[]> {
      if (!isInitialized()) return []
      await supabase!.from('year_goals').delete().eq('id', id)
      return this.getYearGoals(year, memberId)
  }

  async addExpenseHierarchyItem(project: string, category: string, subCategory: string): Promise<boolean> {
      if (!isInitialized()) return false
      await supabase!.from('expense_hierarchy').insert({ project, category, sub_category: subCategory })
      return true
  }

  async getAllExpenseTypes(): Promise<{ id: number; name: string; is_active: number }[]> {
      if (!isInitialized()) return []
      const { data } = await supabase!.from('budget_expense_types').select('*')
      return data || []
  }
  async addExpenseType(name: string): Promise<boolean> { 
      if (!isInitialized()) return false
      await supabase!.from('budget_expense_types').insert({ name })
      return true 
  }
  async updateExpenseType(id: number, name: string): Promise<boolean> { 
       if (!isInitialized()) return false
       await supabase!.from('budget_expense_types').update({ name }).eq('id', id)
       return true
  }
  async toggleExpenseType(id: number, isActive: boolean): Promise<boolean> { 
       if (!isInitialized()) return false
       await supabase!.from('budget_expense_types').update({ is_active: isActive }).eq('id', id)
       return true
  }

  async createFamily(name: string): Promise<number> { 
      if (!isInitialized()) return 0
      const { data } = await supabase!.from('families').insert({ name }).select().single()
      return data?.id || 0
  }
  async getAllFamilies(): Promise<any[]> { 
      if (!isInitialized()) return []
      const { data } = await supabase!.from('families').select('*')
      return data || []
  }
  async deleteFamily(id: number): Promise<boolean> { 
      if (!isInitialized()) return false
      await supabase!.from('families').delete().eq('id', id)
      return true
  }
  
  async createMember(name: string, familyId: number, avatar?: string): Promise<number> { 
      if (!isInitialized()) return 0
      const { data } = await supabase!.from('members').insert({ name, family_id: familyId, avatar }).select().single()
      return data?.id || 0
  }
  async getMembersByFamily(familyId: number): Promise<any[]> { 
      if (!isInitialized()) return []
      const { data } = await supabase!.from('members').select('*').eq('family_id', familyId)
      return data || []
  }
  async getAllMembers(): Promise<any[]> { 
      if (!isInitialized()) return []
      const { data } = await supabase!.from('members').select('*')
      return data || []
  }
  async deleteMember(id: number): Promise<boolean> { 
      if (!isInitialized()) return false
      await supabase!.from('members').delete().eq('id', id)
      return true
  }
}
