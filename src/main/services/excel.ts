import xlsx from 'node-xlsx'

export function generateBudgetTemplate(): Buffer {
  const data: (string | number)[][] = [
    ['费用类型', '项目 (一级)', '分类 (二级)', '子分类 (三级)', '年度预算金额']
  ]
  // Add some example rows
  data.push(['常规费用', '日常开销', '餐饮', '早餐', 5000])
  data.push(['固定费用', '固定支出', '房租', '', 36000])
  
  return xlsx.build([{ name: '预算模板', data, options: {} }])
}

export interface ParsedBudgetRow {
  expense_type: string
  project: string
  category: string
  sub_category: string
  amount: number
}

export function parseBudgetExcel(buffer: ArrayBuffer): ParsedBudgetRow[] {
  const parsed = xlsx.parse(Buffer.from(buffer))
  if (parsed.length === 0) throw new Error('Excel 文件为空')
  
  const sheet = parsed[0]
  const rows = sheet.data
  
  if (rows.length < 2) {
      // Only header or empty
      return []
  }
  
  // Headers check
  const headers = rows[0] as string[]
  // We expect: 费用类型, 项目 (一级), 分类 (二级), 子分类 (三级), 年度预算金额
  // Be flexible with matching
  const map: {[key: string]: number} = {}
  headers.forEach((h, i) => {
      if (typeof h === 'string') {
          if (h.includes('费用类型')) map['type'] = i
          else if (h.includes('项目')) map['project'] = i
          else if (h.includes('分类') && !h.includes('子')) map['category'] = i
          else if (h.includes('子分类')) map['sub'] = i
          else if (h.includes('预算') || h.includes('金额')) map['amount'] = i
      }
  })

  if (map['category'] === undefined || map['amount'] === undefined) {
      throw new Error('Excel 模板格式不正确，必须包含“分类”和“年度预算金额”列')
  }

  const result: ParsedBudgetRow[] = []
  
  // Start from row 1
  for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as any[]
      if (!row || row.length === 0) continue
      
      const category = row[map['category']]
      // Skip empty category rows
      if (!category) continue

      result.push({
          expense_type: map['type'] !== undefined ? (row[map['type']] || '常规费用') : '常规费用',
          project: map['project'] !== undefined ? (row[map['project']] || '') : '',
          category: String(category),
          sub_category: map['sub'] !== undefined ? (row[map['sub']] || '') : '',
          amount: map['amount'] !== undefined ? Number(row[map['amount']] || 0) : 0
      })
  }

  return result
}

export interface ParsedExpenseRow {
  member_name?: string
  project?: string
  category: string
  sub_category?: string
  expense_date: string
  amount: number
  description: string
}

export interface ExpenseImportError {
  rowNumber: number
  message: string
}

export function generateExpenseTemplate(): Buffer {
  const data: (string | number)[][] = [
    ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注'],
    ['爸爸', '餐饮', '一日三餐', '午餐', '2025-01-14', 35.5, '牛肉面'],
    ['妈妈', '交通', '公共交通', '地铁', '2025-01-14', 5.0, '上班通勤'],
  ]

  return xlsx.build([{ name: '模板', data, options: {} }])
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const formatYmd = (date: Date) => {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

const excelSerialToYmd = (serial: number) => {
  const ms = Date.UTC(1899, 11, 30) + serial * 86400 * 1000
  return formatYmd(new Date(ms))
}

const parseLooseYmd = (input: string) => {
  const s = input.trim()
  if (!s) return null

  const m1 = s.match(/^\s*(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\s*$/)
  if (m1) {
    const y = Number(m1[1])
    const m = Number(m1[2])
    const d = Number(m1[3])
    if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`
    }
  }

  const m2 = s.match(/^\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*$/)
  if (m2) {
    const y = Number(m2[1])
    const m = Number(m2[2])
    const d = Number(m2[3])
    if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(m)}-${pad2(d)}`
    }
  }

  return null
}

const normalizeString = (v: unknown) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const parseAmount = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = normalizeString(v)
  if (!s) return null
  const cleaned = s.replace(/[￥¥,\s]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function parseExpenseExcel(buffer: ArrayBuffer): {
  rows: ParsedExpenseRow[]
  errors: ExpenseImportError[]
  headerVersion: 'new' | 'old'
} {
  const parsed = xlsx.parse(Buffer.from(buffer))
  if (parsed.length === 0) throw new Error('Excel 文件为空')

  const sheet = parsed[0]
  const rawRows = sheet.data as any[][]
  if (!rawRows || rawRows.length < 2) return { rows: [], errors: [], headerVersion: 'new' }

  const header = rawRows[0] || []
  const h = header.map((c) => normalizeString(c))

  const requiredNew = ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注']
  const requiredOld = ['项目', '分类', '子分类', '日期', '金额', '备注']

  const isNew = requiredNew.every((name, idx) => (h[idx] || '') === name)
  const isOld = requiredOld.every((name, idx) => (h[idx] || '') === name)

  if (!isNew && !isOld) {
    throw new Error(`表头格式错误。请下载最新模板，确保表头包含：${requiredNew.join(', ')}`)
  }

  const headerVersion: 'new' | 'old' = isNew ? 'new' : 'old'
  const errors: ExpenseImportError[] = []
  const rows: ParsedExpenseRow[] = []

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i] || []
    if (!row || row.length === 0) continue

    try {
      let memberName: unknown
      let project: unknown
      let category: unknown
      let subCategory: unknown
      let rawDate: unknown
      let rawAmount: unknown
      let note: unknown

      if (headerVersion === 'new') {
        ;[memberName, project, category, subCategory, rawDate, rawAmount, note] = row
      } else {
        ;[project, category, subCategory, rawDate, rawAmount, note] = row
      }

      const amount = parseAmount(rawAmount)
      if (amount === null) {
        errors.push({ rowNumber: i + 1, message: '金额无效' })
        continue
      }

      let dateStr = ''
      if (typeof rawDate === 'number' && Number.isFinite(rawDate)) {
        dateStr = excelSerialToYmd(rawDate)
      } else if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
        dateStr = formatYmd(rawDate)
      } else {
        const parsedYmd = parseLooseYmd(normalizeString(rawDate))
        if (parsedYmd) dateStr = parsedYmd
      }

      if (!dateStr) {
        errors.push({ rowNumber: i + 1, message: '日期无效，请使用 YYYY-MM-DD 或 Excel 日期格式' })
        continue
      }

      const c = normalizeString(category) || '其他'
      const desc = normalizeString(note)
      const p = normalizeString(project)
      const sub = normalizeString(subCategory)
      const m = normalizeString(memberName)

      rows.push({
        member_name: headerVersion === 'new' && m ? m : undefined,
        project: p ? p : undefined,
        category: c,
        sub_category: sub ? sub : undefined,
        expense_date: dateStr,
        amount,
        description: desc,
      })
    } catch (e: any) {
      errors.push({ rowNumber: i + 1, message: e?.message || '解析失败' })
    }
  }

  return { rows, errors, headerVersion }
}
