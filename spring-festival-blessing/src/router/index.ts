import { createRouter, createWebHistory } from 'vue-router'

// Lazy load components
const Index = () => import('@/pages/index/index.vue')
const Login = () => import('@/pages/login/index.vue')
const Profile = () => import('@/pages/profile/index.vue')
const Preview = () => import('@/pages/preview/index.vue')
const Works = () => import('@/pages/works/index.vue')

const routes = [
  { path: '/', redirect: '/pages/index/index' },
  { path: '/pages/index/index', name: 'index', component: Index },
  { path: '/pages/login/index', name: 'login', component: Login },
  { path: '/pages/profile/index', name: 'profile', component: Profile },
  { path: '/pages/preview/index', name: 'preview', component: Preview },
  { path: '/pages/works/index', name: 'works', component: Works },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
