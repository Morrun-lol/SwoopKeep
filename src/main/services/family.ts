import db from '../db'

export interface Family {
  id?: number
  name: string
  created_at?: string
}

export interface Member {
  id?: number
  name: string
  family_id?: number
  avatar?: string
  created_at?: string
}

// --- Family Operations ---

export function createFamily(name: string): number {
  try {
    const stmt = db.prepare('INSERT INTO families (name) VALUES (@name)')
    const result = stmt.run({ name })
    return result.lastInsertRowid as number
  } catch (error: any) {
    console.error('Create family failed:', error)
    // If unique constraint violation, maybe return -1 or throw specific error
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
       throw new Error('家庭组名称已存在')
    }
    throw error
  }
}

export function getAllFamilies(): Family[] {
  const stmt = db.prepare('SELECT * FROM families ORDER BY created_at DESC')
  return stmt.all() as Family[]
}

export function getFamilyById(id: number): Family | undefined {
  const stmt = db.prepare('SELECT * FROM families WHERE id = @id')
  return stmt.get({ id }) as Family | undefined
}

export function deleteFamily(id: number): boolean {
  try {
    db.exec('BEGIN TRANSACTION')
    // Delete members first (handled by CASCADE usually, but explicit is safe)
    db.prepare('DELETE FROM members WHERE family_id = ?').run(id)
    const result = db.prepare('DELETE FROM families WHERE id = ?').run(id)
    db.exec('COMMIT')
    return result.changes > 0
  } catch (error) {
    db.exec('ROLLBACK')
    console.error('Failed to delete family:', error)
    return false
  }
}

// --- Member Operations ---

export function createMember(name: string, familyId: number, avatar: string = ''): number {
  const stmt = db.prepare(`
    INSERT INTO members (name, family_id, avatar)
    VALUES (@name, @familyId, @avatar)
  `)
  const result = stmt.run({ name, familyId, avatar })
  return result.lastInsertRowid as number
}

export function getMembersByFamily(familyId: number): Member[] {
  const stmt = db.prepare('SELECT * FROM members WHERE family_id = @familyId ORDER BY created_at ASC')
  return stmt.all({ familyId }) as Member[]
}

export function getAllMembers(): Member[] {
  const stmt = db.prepare('SELECT * FROM members ORDER BY created_at ASC')
  return stmt.all() as Member[]
}

export function deleteMember(id: number): boolean {
  // Note: Expenses associated with this member should probably be handled (set to null or deleted).
  // For now, we keep expenses but they might become "orphan" or belong to family general.
  const stmt = db.prepare('DELETE FROM members WHERE id = @id')
  const result = stmt.run({ id })
  return result.changes > 0
}

export function getMemberById(id: number): Member | undefined {
  const stmt = db.prepare('SELECT * FROM members WHERE id = @id')
  return stmt.get({ id }) as Member | undefined
}
