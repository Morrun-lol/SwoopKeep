import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loader2 } from 'lucide-react'

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6位').regex(/[A-Z]/, '需包含至少一个大写字母').regex(/[0-9]/, '需包含至少一个数字'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function Register() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  })

  const password = watch('password')

  const getStrength = (pass: string) => {
    if (!pass) return 0
    let score = 0
    if (pass.length > 6) score++
    if (pass.match(/[A-Z]/)) score++
    if (pass.match(/[0-9]/)) score++
    if (pass.match(/[^A-Za-z0-9]/)) score++
    return score
  }

  const strength = getStrength(password || '')

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password
      })
      if (error) throw error
      alert('注册成功！请检查邮箱完成验证。')
      navigate('/login')
    } catch (e: any) {
      setError(e.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">创建新账户</h1>
          <p className="text-gray-500 mt-2">开启您的智能记账之旅</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input 
              {...register('password')}
              type="password" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {/* Password Strength Indicator */}
            {password && (
              <div className="flex gap-1 mt-2 h-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`flex-1 rounded-full ${strength >= i ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">需包含大写字母和数字，至少6位</p>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
            <input 
              {...register('confirmPassword')}
              type="password" 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即注册'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          已有账号?{' '}
          <Link to="/login" className="text-emerald-600 font-medium hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
