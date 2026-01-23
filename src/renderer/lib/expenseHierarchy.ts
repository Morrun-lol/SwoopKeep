export type ExpenseHierarchyRow = {
  project: string
  category: string
  sub_category: string
}

export const DEFAULT_PROJECT = '日常开支'
export const DEFAULT_CATEGORY = '其他'
export const DEFAULT_SUB_CATEGORY = '其他'

export const DEFAULT_HIERARCHY_ROW: ExpenseHierarchyRow = {
  project: DEFAULT_PROJECT,
  category: DEFAULT_CATEGORY,
  sub_category: DEFAULT_SUB_CATEGORY,
}

const norm = (s: unknown) => String(s ?? '').trim()

export const normalizeHierarchyRow = (row: any): ExpenseHierarchyRow => {
  return {
    project: norm(row?.project) || DEFAULT_PROJECT,
    category: norm(row?.category) || DEFAULT_CATEGORY,
    sub_category: norm(row?.sub_category) || DEFAULT_SUB_CATEGORY,
  }
}

export const dedupeHierarchyRows = (rows: ExpenseHierarchyRow[]) => {
  const out: ExpenseHierarchyRow[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const key = `${r.project}\u0000${r.category}\u0000${r.sub_category}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

export const ensureDefaultHierarchy = (rows: ExpenseHierarchyRow[]) => {
  const normalized = rows.map(normalizeHierarchyRow)
  const out = dedupeHierarchyRows(normalized)
  const hasDefault = out.some(
    (r) => r.project === DEFAULT_PROJECT && r.category === DEFAULT_CATEGORY && r.sub_category === DEFAULT_SUB_CATEGORY,
  )
  return hasDefault ? out : [DEFAULT_HIERARCHY_ROW, ...out]
}

export const buildHierarchyLookup = (rows: ExpenseHierarchyRow[]) => {
  const allowedTriples = new Set<string>()
  const projects = new Map<string, Set<string>>()
  const categories = new Map<string, Set<string>>()

  for (const r of rows) {
    const project = norm(r.project) || DEFAULT_PROJECT
    const category = norm(r.category) || DEFAULT_CATEGORY
    const sub = norm(r.sub_category) || DEFAULT_SUB_CATEGORY
    allowedTriples.add(`${project}\u0000${category}\u0000${sub}`)

    if (!projects.has(project)) projects.set(project, new Set())
    projects.get(project)!.add(category)

    const catKey = `${project}\u0000${category}`
    if (!categories.has(catKey)) categories.set(catKey, new Set())
    categories.get(catKey)!.add(sub)
  }

  return { allowedTriples, projects, categories }
}

export const isAllowedHierarchyTriple = (
  triple: { project?: any; category?: any; sub_category?: any },
  lookup: ReturnType<typeof buildHierarchyLookup>,
) => {
  const project = norm(triple.project) || DEFAULT_PROJECT
  const category = norm(triple.category) || DEFAULT_CATEGORY
  const sub = norm(triple.sub_category) || DEFAULT_SUB_CATEGORY
  return lookup.allowedTriples.has(`${project}\u0000${category}\u0000${sub}`)
}

export const coerceHierarchyTriple = (
  triple: { project?: any; category?: any; sub_category?: any },
  lookup: ReturnType<typeof buildHierarchyLookup>,
) => {
  const project = norm(triple.project) || DEFAULT_PROJECT
  const category = norm(triple.category) || DEFAULT_CATEGORY
  const sub = norm(triple.sub_category) || DEFAULT_SUB_CATEGORY

  if (lookup.allowedTriples.has(`${project}\u0000${category}\u0000${sub}`)) {
    return { project, category, sub_category: sub }
  }

  const safeProject = lookup.projects.has(project) ? project : DEFAULT_PROJECT
  const safeCategory = lookup.projects.get(safeProject)?.has(category) ? category : DEFAULT_CATEGORY
  const safeSub = lookup.categories.get(`${safeProject}\u0000${safeCategory}`)?.has(sub) ? sub : DEFAULT_SUB_CATEGORY

  return { project: safeProject, category: safeCategory, sub_category: safeSub }
}

