import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

import View from './components/uni-ui/View.vue'
import Text from './components/uni-ui/Text.vue'
import Image from './components/uni-ui/Image.vue'
import Button from './components/uni-ui/Button.vue'

// Create Vue App
const app = createApp(App)

// Use Router
app.use(router)

// Register global components to simulate Uni-app
app.component('view', View)
app.component('text', Text)
app.component('image', Image)
app.component('button', Button)

// Mock uni object for Web Preview
const uniMock = {
  navigateTo: (options: { url: string }) => {
    console.log('navigateTo', options.url)
    // Convert /pages/xxx/xxx to /pages/xxx/index if needed, but router matches paths
    // Our router paths match the uni-app paths: /pages/index/index
    // But uni-app urls are relative or absolute.
    // We assume absolute paths for simplicity.
    router.push(options.url)
  },
  redirectTo: (options: { url: string }) => router.replace(options.url),
  switchTab: (options: { url: string }) => router.push(options.url),
  navigateBack: () => router.back(),
  showToast: (options: { title: string, icon?: string }) => {
    console.log('Toast:', options.title)
    alert(options.title)
  },
  showLoading: (options: { title: string }) => console.log('Loading:', options.title),
  hideLoading: () => console.log('Hide Loading'),
  request: async (options: any) => {
     console.log('Request:', options)
     // Adjust URL if it's relative to API
     let url = options.url
     if (url.startsWith('/api')) {
       // In dev, vite proxies /api to backend usually, or we use absolute URL
       // Current setup: Frontend on 5173, Backend on 3000?
       // vite.config.ts might need proxy.
       // For now assume same origin or proxy handles it.
     }
     
     try {
       const res = await fetch(url, {
         method: options.method || 'GET',
         body: options.method === 'POST' ? JSON.stringify(options.data) : undefined,
         headers: {
           'Content-Type': 'application/json',
           ...options.header
         }
       })
       const data = await res.json()
       if (options.success) options.success({ data, statusCode: res.status })
       return { data, statusCode: res.status }
     } catch (e) {
       console.error(e)
       if (options.fail) options.fail(e)
     }
  },
  getStorageSync: (key: string) => localStorage.getItem(key),
  setStorageSync: (key: string, value: any) => localStorage.setItem(key, value),
  removeStorageSync: (key: string) => localStorage.removeItem(key),
  login: (options: any) => {
    // Mock login
    if (options.success) options.success({ code: 'mock_code_123' })
  },
  getUserProfile: (options: any) => {
    // Mock user profile
    if (options.success) options.success({ 
      userInfo: { 
        nickName: 'Test User', 
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        gender: 1
      } 
    })
  }
}

// @ts-ignore
window.uni = uniMock

// Mount
app.mount('#app')
