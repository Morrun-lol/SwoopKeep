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
