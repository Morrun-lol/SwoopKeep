import { useState, useEffect } from 'react'
import { Plus, Users, Trash2, UserPlus, Home } from 'lucide-react'

interface Family {
  id: number
  name: string
  created_at: string
}

interface Member {
  id: number
  name: string
  family_id: number
  avatar?: string
  created_at: string
}

export default function UserLedger() {
  const [families, setFamilies] = useState<Family[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null)
  
  // Forms
  const [newFamilyName, setNewFamilyName] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadFamilies()
  }, [])

  useEffect(() => {
    if (selectedFamilyId) {
      loadMembers(selectedFamilyId)
    } else {
      setMembers([])
    }
  }, [selectedFamilyId])

  const loadFamilies = async () => {
    try {
      const data = await window.api.getAllFamilies()
      setFamilies(data)
      if (data.length > 0 && !selectedFamilyId) {
        setSelectedFamilyId(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load families:', error)
    }
  }

  const loadMembers = async (familyId: number) => {
    try {
      const data = await window.api.getMembersByFamily(familyId)
      setMembers(data)
    } catch (error) {
      console.error('Failed to load members:', error)
    }
  }

  const handleCreateFamily = async () => {
    if (!newFamilyName.trim()) return
    setIsLoading(true)
    try {
      await window.api.createFamily(newFamilyName)
      setNewFamilyName('')
      await loadFamilies()
    } catch (error) {
      console.error('Failed to create family:', error)
      alert('创建家庭组失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteFamily = async (id: number) => {
    if (!confirm('确定要删除这个家庭组吗？组内所有成员也将被删除！')) return
    try {
      await window.api.deleteFamily(id)
      if (selectedFamilyId === id) setSelectedFamilyId(null)
      await loadFamilies()
    } catch (error) {
      console.error('Failed to delete family:', error)
    }
  }

  const handleCreateMember = async () => {
    if (!newMemberName.trim() || !selectedFamilyId) return
    setIsLoading(true)
    try {
      // Use a default avatar or random one
      const avatars = ['👨', '👩', '👴', '👵', '👦', '👧', '👶', '🧑']
      const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)]
      
      await window.api.createMember(newMemberName, selectedFamilyId, randomAvatar)
      setNewMemberName('')
      await loadMembers(selectedFamilyId)
    } catch (error) {
      console.error('Failed to create member:', error)
      alert('添加成员失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteMember = async (id: number) => {
    if (!confirm('确定要删除这个成员吗？')) return
    try {
      await window.api.deleteMember(id)
      if (selectedFamilyId) await loadMembers(selectedFamilyId)
    } catch (error) {
      console.error('Failed to delete member:', error)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl md:text-3xl font-bold text-gray-900">用户账本</h1>
           <p className="mt-1 text-sm md:text-base text-gray-600">管理家庭组及成员账本</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column: Families List */}
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-gray-200 flex flex-col h-auto md:h-[600px] min-h-[300px]">
           <div className="flex justify-between items-center mb-4">
              <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                <Home className="w-5 h-5 text-emerald-500" /> 家庭组
              </h2>
           </div>
           
           <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="新家庭组名称" 
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-w-0"
                value={newFamilyName}
                onChange={e => setNewFamilyName(e.target.value)}
              />
              <button 
                onClick={handleCreateFamily} 
                disabled={isLoading || !newFamilyName.trim()}
                className="bg-emerald-500 text-white px-3 py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>
           </div>

           <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px] md:max-h-none">
              {families.map(family => (
                <div 
                  key={family.id}
                  onClick={() => setSelectedFamilyId(family.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    selectedFamilyId === family.id 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                      : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  <span className="font-medium text-sm md:text-base">{family.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFamily(family.id)
                    }}
                    className="md:opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {families.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                  暂无家庭组，请创建
                </div>
              )}
           </div>
        </div>

        {/* Right Column: Members List */}
        <div className="md:col-span-2 bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-gray-200 flex flex-col h-auto md:h-[600px] min-h-[400px]">
           {selectedFamilyId ? (
             <>
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" /> 
                    {families.find(f => f.id === selectedFamilyId)?.name} 的成员
                  </h2>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-4 overflow-y-auto flex-1 content-start pr-1">
                  {/* Add Member Card */}
                  <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 md:p-4 flex flex-col items-center justify-center gap-2 md:gap-3 min-h-[120px] md:min-h-[140px]">
                     <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm">
                        <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
                     </div>
                     <div className="w-full flex gap-2">
                        <input 
                          type="text" 
                          placeholder="成员名称" 
                          className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center bg-white outline-none focus:border-blue-500 min-w-0"
                          value={newMemberName}
                          onChange={e => setNewMemberName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCreateMember()}
                        />
                     </div>
                     <button 
                        onClick={handleCreateMember}
                        disabled={isLoading || !newMemberName.trim()}
                        className="text-xs md:text-sm text-blue-600 font-medium hover:underline disabled:opacity-50"
                     >
                        添加新成员
                     </button>
                  </div>

                  {members.map(member => (
                    <div key={member.id} className="relative group bg-white border border-gray-200 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-2 md:gap-3 min-h-[120px] md:min-h-[140px] justify-center">
                       <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="absolute top-1 right-1 md:top-2 md:right-2 p-1 text-gray-300 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                       <div className="text-center">
                          <h3 className="font-bold text-gray-800 text-base md:text-lg truncate max-w-[100px]">{member.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">独立账本</p>
                       </div>
                    </div>
                  ))}
               </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 py-12 md:py-0">
                <Home className="w-16 h-16 opacity-20" />
                <p>请在上方选择或创建一个家庭组</p>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
