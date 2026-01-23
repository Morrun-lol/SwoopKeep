type ParsedExpense = {
  project: string
  category: string
  sub_category: string
  amount: number
  expense_date: string
  description: string
  member_name: string | null
  missing_info: string[]
}

const todayYmd = () => new Date().toISOString().slice(0, 10)

const normalize = (s: string) => {
  const input = String(s || '').trim()
  if (!input) return ''
  return input
    .replace(/^测试数据[:：\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractAmount = (text: string) => {
  const s = normalize(text)
  const m = s.match(/(-?\d+(?:\.\d+)?)(?=\s*(?:元|块|¥|￥))/g)
  if (m && m.length) return Number(m[m.length - 1])
  const all = s.match(/-?\d+(?:\.\d+)?/g)
  if (all && all.length) return Number(all[all.length - 1])
  return NaN
}

const pickHierarchy = (
  text: string,
  hierarchy?: { project?: string; category?: string; sub_category?: string }[]
) => {
  const s = normalize(text)
  const list = Array.isArray(hierarchy) ? hierarchy : []
  if (!list.length) {
    return { project: '日常开支', category: '其他', sub_category: '其他' }
  }

  const safe = list
    .map((h) => ({
      project: String(h?.project || '').trim(),
      category: String(h?.category || '').trim(),
      sub_category: String(h?.sub_category || '').trim(),
    }))
    .filter((h) => h.project && h.category)

  const byScore = (h: { project: string; category: string; sub_category: string }) => {
    let score = 0
    if (h.sub_category && s.includes(h.sub_category)) score += 3
    if (h.category && s.includes(h.category)) score += 2
    if (h.project && s.includes(h.project)) score += 1
    return score
  }

  let best = safe[0]
  let bestScore = -1
  for (const h of safe) {
    const sc = byScore(h)
    if (sc > bestScore) {
      bestScore = sc
      best = h
    }
  }

  if (bestScore <= 0) {
    const fallback = safe.find((h) => h.category === '其他' && h.sub_category === '其他') || safe[0]
    return {
      project: fallback.project || '日常开支',
      category: fallback.category || '其他',
      sub_category: fallback.sub_category || '其他',
    }
  }

  return {
    project: best.project || '日常开支',
    category: best.category || '其他',
    sub_category: best.sub_category || '其他',
  }
}

const pickMember = (text: string, members?: { name?: string }[]) => {
  const s = normalize(text)
  const list = Array.isArray(members) ? members : []
  for (const m of list) {
    const name = String(m?.name || '').trim()
    if (name && s.includes(name)) return name
  }
  return null
}

export const localParseExpense = (inputText: string, context?: any): { expenses: ParsedExpense[]; provider: string } => {
  const text = normalize(inputText)

  const amount = extractAmount(text)
  const missing_info: string[] = []
  if (!Number.isFinite(amount)) missing_info.push('amount')

  const ymd = todayYmd()
  const description = text || '消费'

  const hierarchy = Array.isArray(context?.hierarchy) ? context.hierarchy : undefined
  const members = Array.isArray(context?.members) ? context.members : undefined
  const picked = pickHierarchy(text, hierarchy)
  const member_name = pickMember(text, members)

  const exp: ParsedExpense = {
    project: picked.project,
    category: picked.category,
    sub_category: picked.sub_category,
    amount: Number.isFinite(amount) ? amount : 0,
    expense_date: ymd,
    description,
    member_name,
    missing_info,
  }

  return { expenses: [exp], provider: 'local' }
}

