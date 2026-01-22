import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabase } from '../../lib/supabase'
import { Loader2, ArrowLeft } from 'lucide-react'

const forgotSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema)
  })

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const supabase = getSupabase()
      if (!supabase) {
        navigate('/config')
        return
      }
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: window.location.origin + '/reset-password', // Assuming we have this route later or just login
      })
      if (error) throw error
      setMessage('重置链接已发送到您的邮箱，请查收。')
    } catch (e: any) {
      setError(e.message || '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <Link to="/login" className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回登录
        </Link>
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">找回密码</h1>
          <p className="text-gray-500 mt-2">输入您的注册邮箱，我们将向您发送重置链接</p>
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

          {message && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg">{message}</div>}
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '发送重置链接'}
          </button>
        </form>
      </div>
    </div>
  )
}
