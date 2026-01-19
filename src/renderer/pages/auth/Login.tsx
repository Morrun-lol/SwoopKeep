import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loader2, MessageSquare, Phone } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6位'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })
      if (error) throw error
      navigate('/')
    } catch (e: any) {
      setError(e.message || '登录失败，请检查账号密码')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = (provider: string) => {
    alert(`${provider} 登录功能开发中...`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">欢迎回来</h1>
          <p className="text-gray-500 mt-2">请登录您的账户以继续</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input 
              {...register('email')}
              type="email" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="name@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">密码</label>
              <Link to="/forgot-password" className="text-xs text-emerald-600 hover:underline">忘记密码?</Link>
            </div>
            <input 
              {...register('password')}
              type="password" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '登录'}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">其他登录方式</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <button onClick={() => handleSocialLogin('微信')} className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <MessageSquare className="w-6 h-6 text-green-600 mb-1" />
              <span className="text-xs text-gray-600">微信</span>
            </button>
            <button onClick={() => handleSocialLogin('短信')} className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Phone className="w-6 h-6 text-blue-600 mb-1" />
              <span className="text-xs text-gray-600">短信</span>
            </button>
            <button onClick={() => handleSocialLogin('小红书')} className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-6 h-6 bg-red-500 rounded text-white flex items-center justify-center text-xs font-bold">小</div>
              <span className="text-xs text-gray-600 mt-1">小红书</span>
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          还没有账号?{' '}
          <Link to="/register" className="text-emerald-600 font-medium hover:underline">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}
