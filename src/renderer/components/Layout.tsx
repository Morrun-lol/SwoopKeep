import { Link, useLocation } from 'react-router-dom'
import { Mic, History, Settings, Home, Target, Users } from 'lucide-react'
import { clsx } from 'clsx'

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  const navItems = [
    { icon: Home, label: '首页', path: '/' },
    { icon: Mic, label: '咻记一下', path: '/voice' },
    { icon: Target, label: '预算目标', path: '/budget-config' },
    { icon: Users, label: '用户账本', path: '/user-ledger' },
    { icon: History, label: '历史记录', path: '/history' },
    { icon: Settings, label: '设置', path: '/settings' },
  ]

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans flex-col md:flex-row">
      {/* Sidebar - Hidden on Mobile */}
      <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Mic className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-gray-800">咻记一下助手</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className={clsx('w-5 h-5', isActive ? 'text-emerald-500' : 'text-gray-400')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="text-xs text-gray-400 text-center">
            v1.0.0
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-20 md:pb-0">
        <main className="px-4 pb-4 pt-safe-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Visible on Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between items-center px-2 py-2 pb-safe safe-area-inset-bottom z-50">
        {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center justify-center p-1 rounded-lg transition-colors flex-1 min-w-0',
                  isActive
                    ? 'text-emerald-600'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon className={clsx('w-6 h-6', isActive ? 'text-emerald-600' : 'text-gray-400')} />
                <span className="text-[10px] mt-1 truncate w-full text-center">{item.label}</span>
              </Link>
            )
        })}
      </div>
    </div>
  )
}
