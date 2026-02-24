import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { loadRuntimeConfig } from '../lib/runtimeConfig'

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [importHistory, setImportHistory] = useState<any[]>([])
  const [importJobs, setImportJobs] = useState<Record<number, any>>({})

  useEffect(() => {
    loadHistory()
    const unsubProgress = window.api.onImportExcelProgress
      ? window.api.onImportExcelProgress((payload: any) => {
          if (!payload?.importId) return
          setImportJobs((prev) => ({ ...prev, [payload.importId]: payload }))
        })
      : undefined

    const unsubDone = window.api.onImportExcelDone
      ? window.api.onImportExcelDone((payload: any) => {
          if (!payload?.importId) return
          setImportJobs((prev) => ({ ...prev, [payload.importId]: payload }))
          const skipped = payload.skipped ? `, 跳过重复: ${payload.skipped}` : ''
          const details = payload.errors?.length
            ? `\n失败明细(前5条)：${payload.errors.slice(0, 5).map((e: any) => `\n- 第${e.rowNumber}行：${e.message}`).join('')}`
            : ''
          setMessage(`✅ 导入完成! 成功: ${payload.success || 0}, 失败: ${payload.failed || 0}${skipped}${details}`)
          loadHistory()
        })
      : undefined

    return () => {
      unsubProgress?.()
      unsubDone?.()
    }
  }, [])

  const loadHistory = async () => {
    try {
        const history = await window.api.getImportHistory()
        setImportHistory(history)

        const processing = (history || []).filter((r: any) => r?.status === 'processing')
        if (processing.length > 0 && window.api.getImportJobStatus) {
          const statuses = await Promise.all(
            processing.map((r: any) => window.api.getImportJobStatus(r.id).catch(() => null))
          )
          const patch: Record<number, any> = {}
          statuses.forEach((s: any) => {
            if (s?.importId) patch[s.importId] = s
          })
          if (Object.keys(patch).length > 0) setImportJobs((prev) => ({ ...prev, ...patch }))
        }
    } catch (e) {
        console.error('Failed to load history', e)
    }
  }

  const handleDeleteRecord = async (id: number) => {
    if (!confirm('确定要删除这条导入记录吗？删除后，该次导入的所有账单数据将被清空，且无法恢复。')) return
    try {
        const success = await window.api.deleteImportRecord(id)
        if (success) {
            alert('删除成功')
            loadHistory()
        } else {
            alert('删除失败')
        }
    } catch (e) {
        alert('操作失败')
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await window.api.downloadTemplate()
      setMessage('✅ 模板已下载到桌面')
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      setMessage(`❌ 下载失败: ${error.message}`)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setMessage('❌ 请上传 Excel 文件 (.xlsx, .xls)')
      return
    }

    setIsUploading(true)
    setMessage('正在处理...')

    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await window.api.importExcel(arrayBuffer, file.name)

      if (result?.importId && result?.status === 'processing') {
        setMessage(`📤 已开始导入（共 ${result.total || 0} 行），可在下方查看进度。`)
        setImportJobs((prev) => ({
          ...prev,
          [result.importId!]: {
            importId: result.importId,
            status: 'processing',
            total: result.total || 0,
            processed: 0,
            success: 0,
            failed: result.failed || 0,
            skipped: 0,
          },
        }))
        loadHistory()
      } else {
        const skipped = result?.skipped ? `, 跳过重复: ${result.skipped}` : ''
        const details = result?.errors?.length
          ? `\n失败明细(前5条)：${result.errors.slice(0, 5).map((er: any) => `\n- 第${er.rowNumber}行：${er.message}`).join('')}`
          : ''
        setMessage(`✅ 导入完成! 成功: ${result?.success || 0}, 失败: ${result?.failed || 0}${skipped}${details}`)
        loadHistory()
      }
    } catch (error: any) {
      console.error(error)
      setMessage(`❌ 导入失败: ${error.message}`)
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">设置</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">账户信息</h2>
              <p className="text-sm text-gray-500 mt-1">管理您的登录状态和个人信息</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                   <User size={20} />
               </div>
               <div className="text-right hidden sm:block">
                   <div className="text-sm font-medium text-gray-900">{user?.email || '未登录'}</div>
                   <div className="text-xs text-gray-400">UID: {user?.id?.slice(0, 8)}...</div>
               </div>
            </div>
        </div>
        <div className="p-6">
            <button 
                onClick={async () => {
                    if (confirm('确定要退出登录吗？')) {
                        await signOut()
                        navigate('/login')
                    }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
                <LogOut size={16} />
                退出登录
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">连接设置</h2>
            <p className="text-sm text-gray-500 mt-1">修改 Supabase 与 AI API Base URL</p>
          </div>
          <button
            onClick={() => navigate('/config')}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            打开配置
          </button>
        </div>
        <div className="p-6 text-sm text-gray-600 space-y-2">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">AI API Base URL</span>
            <span className="text-right break-all">{loadRuntimeConfig().apiBaseUrl || '未设置'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Supabase URL</span>
            <span className="text-right break-all">{loadRuntimeConfig().supabaseUrl || '未设置'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">数据导入</h2>
          <p className="text-sm text-gray-500 mt-1">批量导入记账数据或更新分类体系</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
              📥
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">第一步：下载模板</h3>
              <p className="text-sm text-gray-500 mt-1 mb-3">
                请先下载标准 Excel 模板，严格按照模板格式填写数据。<br/>
                <span className="text-xs text-gray-400">包含列：费用归属、项目(一级)、分类(二级)、子分类(三级)、日期、金额、备注</span>
              </p>
              <button 
                onClick={handleDownloadTemplate}
                className="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                下载 Excel 模板
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100"></div>

          <div className="flex items-start gap-4">
            <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
              📤
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">第二步：上传文件</h3>
              <p className="text-sm text-gray-500 mt-1 mb-3">
                上传填写好的 Excel 文件，系统将自动解析并导入数据。
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <label className={`
                    relative cursor-pointer bg-emerald-600 text-white px-5 py-3 rounded-lg hover:bg-emerald-700 transition-colors
                    inline-flex items-center justify-center whitespace-nowrap min-w-[140px]
                    ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}>
                    <span>{isUploading ? '正在导入...' : '选择文件上传'}</span>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={handleUpload}
                      disabled={isUploading}
                      className="hidden" 
                    />
                  </label>
                </div>

                {message && (
                  <div className={`text-sm whitespace-pre-line ${message.startsWith('✅') ? 'text-emerald-600' : message.startsWith('📤') ? 'text-blue-600' : 'text-red-600'}`}>
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
