import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [importHistory, setImportHistory] = useState<any[]>([])
  const [importJobs, setImportJobs] = useState<Record<number, any>>({})

  // Env Config State
  // const [envConfig, setEnvConfig] = useState({
  //   httpsProxy: '',
  //   openAiKey: '',
  //   openAiBaseUrl: '',
  //   geminiKey: ''
  // })
  // const [isSavingConfig, setIsSavingConfig] = useState(false)

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

  // const loadEnvConfig = async () => {
  //   try {
  //       const config = await window.api.getEnvConfig()
  //       setEnvConfig(config)
  //   } catch (e) {
  //       console.error('Failed to load env config', e)
  //   }
  // }

  // const handleSaveConfig = async () => {
  //   setIsSavingConfig(true)
  //   try {
  //       await window.api.saveEnvConfig(envConfig)
  //       alert('配置已保存！部分配置可能需要重启应用生效。')
  //   } catch (e) {
  //       alert('保存失败')
  //   } finally {
  //       setIsSavingConfig(false)
  //   }
  // }

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

    // 检查文件类型
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
      // 清空 input，允许再次上传同一个文件
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">设置</h1>

      {/* 账户信息 */}
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
      
      {/* 网络与 API 设置 */}
      {/* 
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">网络与 API 设置</h2>
          <p className="text-sm text-gray-500 mt-1">配置网络代理和 OpenAI API 密钥以使用 AI 功能</p>
        </div>
        <div className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HTTP 代理 (解决魔法上网问题)</label>
                <input 
                    type="text" 
                    value={envConfig.httpsProxy}
                    onChange={(e) => setEnvConfig({...envConfig, httpsProxy: e.target.value})}
                    placeholder="http://127.0.0.1:7890"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">
                    如果您使用 v2ray/clash 等软件，请填写其本地代理端口。通常为 http://127.0.0.1:7890 或 10809。
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                    <input 
                        type="password" 
                        value={envConfig.openAiKey}
                        onChange={(e) => setEnvConfig({...envConfig, openAiKey: e.target.value})}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI Base URL</label>
                    <input 
                        type="text" 
                        value={envConfig.openAiBaseUrl}
                        onChange={(e) => setEnvConfig({...envConfig, openAiBaseUrl: e.target.value})}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                <input 
                    type="password" 
                    value={envConfig.geminiKey}
                    onChange={(e) => setEnvConfig({...envConfig, geminiKey: e.target.value})}
                    placeholder="AIza..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
            </div>

            <div className="pt-2">
                <button
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {isSavingConfig ? '保存中...' : '保存配置'}
                </button>
            </div>
        </div>
      </div> 
      */}

      {/* 记账分类/数据导入 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">数据导入</h2>
          <p className="text-sm text-gray-500 mt-1">批量导入记账数据或更新分类体系</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* 下载模板 */}
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

          {/* 上传文件 */}
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

              {Object.values(importJobs).some((j: any) => j?.status === 'processing') && (
                <div className="mt-3 space-y-2">
                  {Object.values(importJobs)
                    .filter((j: any) => j?.status === 'processing')
                    .slice(0, 1)
                    .map((job: any) => {
                      const total = Number(job.total || 0)
                      const processed = Number(job.processed || 0)
                      const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
                      const startedAt = Number(job.startedAt || 0)
                      const elapsedSec = startedAt ? Math.max(1, (Date.now() - startedAt) / 1000) : 1
                      const speed = processed / elapsedSec
                      const remaining = Math.max(0, total - processed)
                      const etaSec = speed > 0 ? Math.round(remaining / speed) : 0
                      const etaText = etaSec > 0 ? `${Math.floor(etaSec / 60)}m${etaSec % 60}s` : '-'
                      const paused = !!job.paused
                      return (
                        <div key={job.importId} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-blue-700 whitespace-nowrap">正在导入... {pct}%（{processed}/{total}）</div>
                            <div className="flex items-center gap-3">
                              {typeof (window.api as any).pauseImportJob === 'function' && typeof (window.api as any).resumeImportJob === 'function' && (
                                <button
                                  onClick={async () => {
                                    if (paused) {
                                      await (window.api as any).resumeImportJob(job.importId)
                                    } else {
                                      await (window.api as any).pauseImportJob(job.importId)
                                    }
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                                >
                                  {paused ? '继续' : '暂停'}
                                </button>
                              )}
                              {typeof (window.api as any).cancelImportJob === 'function' && (
                                <button
                                  onClick={async () => {
                                    if (!confirm('确定要取消本次导入吗？')) return
                                    await (window.api as any).cancelImportJob(job.importId)
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                                >
                                  取消
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 h-2 bg-blue-100 rounded">
                            <div className="h-2 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-2 text-xs text-blue-600 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="whitespace-nowrap">成功: {job.success || 0}</span>
                            <span className="whitespace-nowrap">失败: {job.failed || 0}</span>
                            <span className="whitespace-nowrap">跳过: {job.skipped || 0}</span>
                            <span className="whitespace-nowrap">速度: {speed.toFixed(1)} 行/秒</span>
                            <span className="whitespace-nowrap">剩余: {etaText}</span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 导入记录 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900">导入记录</h2>
                <p className="text-sm text-gray-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    管理已上传的数据文件
                </p>
            </div>
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <button
                    onClick={async () => {
                        if (!confirm('确定要清理所有重复的账单记录吗？将保留最早的一条，删除其余完全重复的记录。')) return
                        try {
                            const count = await window.api.cleanDuplicateData()
                            alert(`清理完成，共删除了 ${count} 条重复记录`)
                            loadHistory()
                        } catch (e) {
                            alert('清理失败')
                        }
                    }}
                    className="h-12 px-4 bg-orange-50 text-orange-600 rounded-xl border border-orange-200 hover:bg-orange-100 transition-all flex items-center justify-center gap-2 text-sm font-bold whitespace-nowrap active:scale-[0.98] shadow-sm flex-1 md:flex-initial min-w-[140px]"
                >
                    <span>🧹</span>
                    清理重复数据
                </button>
                <button
                    onClick={async () => {
                        if (!confirm('⚠️ 严重警告：确定要清空所有数据吗？\n\n这将删除所有账单、预算目标和导入记录，且无法恢复！')) return
                        if (!confirm('请再次确认：真的要删除所有数据吗？')) return
                        try {
                            const success = await window.api.clearAllData()
                            if (success) {
                                alert('所有数据已清空')
                                loadHistory()
                            } else {
                                alert('清空失败')
                            }
                        } catch (e) {
                            alert('操作失败')
                        }
                    }}
                    className="h-12 px-4 bg-red-50 text-red-600 rounded-xl border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2 text-sm font-bold whitespace-nowrap active:scale-[0.98] shadow-sm flex-1 md:flex-initial min-w-[160px]"
                >
                    <span>🗑️</span>
                    一键清空所有数据
                </button>
            </div>
        </div>
        <div className="p-0 overflow-x-auto">
            {importHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">暂无导入记录</div>
            ) : (
                <table className="min-w-[720px] w-full text-sm text-left table-auto">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-6 py-3 font-medium whitespace-nowrap w-44">导入时间</th>
                            <th className="px-6 py-3 font-medium whitespace-nowrap w-28">类型</th>
                            <th className="px-6 py-3 font-medium whitespace-nowrap min-w-[220px]">数据量</th>
                            <th className="px-6 py-3 font-medium text-right whitespace-nowrap w-20 hidden sm:table-cell">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {importHistory.map(record => (
                            <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                    {format(new Date(record.import_date), 'yyyy-MM-dd HH:mm')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                        record.import_type === 'expense' 
                                        ? 'bg-emerald-100 text-emerald-700' 
                                        : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {record.import_type === 'expense' ? '账单数据' : '预算目标'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-gray-600">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="whitespace-nowrap">
                                        {record.status === 'processing'
                                          ? (() => {
                                              const job = importJobs[record.id]
                                              const processed = Number(job?.processed || record.processed_rows || 0)
                                              const total = Number(job?.total || record.total_rows || 0)
                                              const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
                                              return `${record.record_count || 0}/${total || '-'} 条（处理中 ${pct}%）`
                                            })()
                                          : `${record.record_count || 0} 条`}
                                      </span>

                                      <button
                                        onClick={() => handleDeleteRecord(record.id)}
                                        className="sm:hidden text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
                                      >
                                        删除
                                      </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap hidden sm:table-cell">
                                    <button 
                                        onClick={() => handleDeleteRecord(record.id)}
                                        className="text-red-600 hover:text-red-800 hover:underline font-medium"
                                    >
                                        删除
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>
      
    </div>
  )
}
