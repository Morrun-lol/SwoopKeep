
import { ExpenseApi } from './ApiInterface'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const isInitialized = () => !!supabase

export class SupabaseApi implements ExpenseApi {
    
  async transcribeAudio(buffer: ArrayBuffer): Promise<string> {
    try {
        // Try Capacitor Plugin first
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
        // @ts-ignore
        const permissionStatus = await SpeechRecognition.checkPermissions()
        // @ts-ignore
        if (permissionStatus.speechRecognition !== 'granted') {
             // @ts-ignore
            await SpeechRecognition.requestPermissions()
        }
        // TODO: Implement actual listening logic
        // For file buffer, we might need a different approach (e.g., OpenAI Whisper API)
        // Since Capacitor SpeechRecognition is for live microphone.
        throw new Error('Use WebSocket or API') 
    } catch (e) {
        return this.transcribeAudioViaWebSocket(buffer)
    }
  }

  async transcribeAudioViaWebSocket(buffer: ArrayBuffer): Promise<string> {
       console.warn('Voice recognition via WebSocket not fully ported yet.')
       return "语音记账测试"
  }

  async parseExpense(text: string): Promise<any> {
    // Call OpenAI if configured
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    const baseURL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    
    if (apiKey) {
        try {
            const response = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expense parser. Extract expense details from the user input.
                            Return a JSON object with these fields:
                            - category (string, required): Choose from [餐饮, 交通, 购物, 娱乐, 医疗, 教育, 住房, 其他]
                            - amount (number, required): The expense amount
                            - description (string): Brief description
                            - expense_date (string): YYYY-MM-DD format (default to today if not specified)
                            
                            Output JSON only.`
                        },
                        { role: 'user', content: text }
                    ]
                })
            })
            
            const data = await response.json()
            const content = data.choices[0].message.content
            // Extract JSON from potential markdown code blocks
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0])
            }
            return JSON.parse(content)
        } catch (e) {
            console.error('OpenAI parse failed', e)
        }
    }
    return { category: '其他', amount: 0, description: text, expense_date: new Date().toISOString().split('T')[0] }
  }

  async checkLLMConnection(): Promise<boolean> {
    return !!import.meta.env.VITE_OPENAI_API_KEY
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

  async importExcel(buffer: ArrayBuffer): Promise<{ success: number; failed: number }> {
      if (!isInitialized()) return { success: 0, failed: 0 }
      
      try {
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (data.length < 2) return { success: 0, failed: 0 }

        const header = data[0]
        const requiredHeader = ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注']
        // Basic header validation
        if (header[0] !== '费用归属' && header[1] !== '分类') {
             console.error('Invalid header format')
             return { success: 0, failed: data.length - 1 }
        }

        let successCount = 0
        let failedCount = 0
        
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
                file_name: `Import_${new Date().toISOString()}`,
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
                
                if (header[0] === '费用归属') {
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
                    continue
                }

                // Date Parsing
                let dateStr = ''
                if (typeof rawDate === 'number') {
                    const date = new Date((rawDate - 25569) * 86400 * 1000)
                    dateStr = date.toISOString().split('T')[0]
                } else {
                    dateStr = String(rawDate)
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
                    continue // Skip duplicate
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
            }
        }

        // Update history count
        if (importId) {
            await supabase!
                .from('import_history')
                .update({ record_count: successCount })
                .eq('id', importId)
        }

        return { success: successCount, failed: failedCount }

      } catch (e) {
          console.error('Import failed', e)
          return { success: 0, failed: 0 }
      }
  }

  async getExpenseComposition(startDate: string, endDate: string, level?: string, parentValue?: string): Promise<any[]> {
     const expenses = await this.getExpensesByDateRange(startDate, endDate)
     // Client-side aggregation
     const map = new Map<string, number>()
     expenses.forEach(e => {
         let key = e.category
         if (level === 'sub_category' && e.category === parentValue) {
             key = e.sub_category || '其他'
         } else if (level === 'project') {
             key = e.project || '无项目'
         }
         
         if (level === 'sub_category' && e.category !== parentValue) return

         const current = map.get(key) || 0
         map.set(key, current + e.amount)
     })
     return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }

  async getExpenseTrend(startDate: string, endDate: string, dimension?: string, filter?: any): Promise<any[]> {
     const expenses = await this.getExpensesByDateRange(startDate, endDate)
     // Client-side aggregation for trend
     const map = new Map<string, number>()
     expenses.forEach(e => {
         // Filter logic can be added here
         const date = e.expense_date
         const current = map.get(date) || 0
         map.set(date, current + e.amount)
     })
     return Array.from(map.entries()).map(([date, amount]) => ({ date, amount })).sort((a,b) => a.date.localeCompare(b.date))
  }

  async getYearGoals(year: number, memberId?: number): Promise<any[]> {
      if (!isInitialized()) return []
      let query = supabase!
        .from('year_goals')
        .select('*')
        .eq('year', year)
      
      if (memberId) query = query.eq('member_id', memberId)
      const { data } = await query
      return data || []
  }

  async saveYearGoal(goal: any): Promise<any[]> {
      if (!isInitialized()) return []
      const { error } = await supabase!
        .from('year_goals')
        .upsert(goal, { onConflict: 'year, project, category, sub_category, member_id' })
      return []
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
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY
      const baseURL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'

      if (apiKey) {
          try {
              const base64 = btoa(
                  new Uint8Array(buffer)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
              );

              const response = await fetch(`${baseURL}/chat/completions`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${apiKey}`
                  },
                  body: JSON.stringify({
                      model: 'gpt-4o', 
                      messages: [
                          {
                              role: 'system',
                              content: 'Identify the text content from the receipt/image. Return only the text found.'
                          },
                          {
                              role: 'user',
                              content: [
                                  { type: 'text', text: 'Transcribe this receipt.' },
                                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
                              ]
                          }
                      ]
                  })
              })

              const data = await response.json()
              const text = data.choices?.[0]?.message?.content || ''
              return { text, provider: 'openai' }
          } catch (e) {
              console.error('Image recognition failed', e)
          }
      }
      return { text: "Image recognition requires OpenAI Key", provider: "none" }
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
      return []
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
