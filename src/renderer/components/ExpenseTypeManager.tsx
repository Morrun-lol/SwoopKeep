import { useState, useEffect } from 'react'
import { Plus, X, Edit2, Check, Trash2 } from 'lucide-react'

interface ExpenseType {
  id: number
  name: string
  is_active: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onChange: () => void
}

export default function ExpenseTypeManager({ isOpen, onClose, onChange }: Props) {
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [newType, setNewType] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadTypes()
    }
  }, [isOpen])

  const loadTypes = async () => {
    const data = await window.api.getAllExpenseTypes()
    setTypes(data)
  }

  const handleAdd = async () => {
    if (!newType.trim()) return
    const success = await window.api.addExpenseType(newType.trim())
    if (success) {
      setNewType('')
      loadTypes()
      onChange()
    }
  }

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return
    const success = await window.api.updateExpenseType(id, editName.trim())
    if (success) {
      setEditingId(null)
      loadTypes()
      onChange()
    }
  }

  const handleToggle = async (id: number, currentStatus: number) => {
    const success = await window.api.toggleExpenseType(id, !currentStatus)
    if (success) {
      loadTypes()
      onChange()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">费用类型管理</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="输入新类型名称..."
            className="flex-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {types.map((type) => (
            <div key={type.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
              {editingId === type.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button onClick={() => handleUpdate(type.id)} className="text-emerald-600 hover:text-emerald-700">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-2 h-2 rounded-full ${type.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} 
                    />
                    <span className={`font-medium ${type.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                      {type.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingId(type.id)
                        setEditName(type.name)
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleToggle(type.id, type.is_active)}
                      className={`p-1 text-xs font-medium rounded px-2 ${
                        type.is_active 
                          ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                          : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {type.is_active ? '禁用' : '启用'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}