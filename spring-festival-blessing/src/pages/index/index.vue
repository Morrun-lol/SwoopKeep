<template>
  <view class="container">
    <!-- Animation Layer -->
    <view class="animation-bg">
      <view class="firework" v-for="i in 5" :key="i" :style="fireworkStyle(i)"></view>
      <view class="zodiac-horse">🐎</view>
    </view>

    <!-- Content Layer -->
    <view class="content">
      <view class="header">
        <text class="title">Spring Festival Blessing</text>
      </view>

      <view class="user-info" v-if="userInfo">
        <image class="avatar" :src="userInfo.avatarUrl" mode="aspectFill" />
        <text class="nickname">{{ userInfo.nickName }}</text>
      </view>
      <view class="login-btn" v-else>
        <button type="primary" @click="handleLogin">Login with WeChat</button>
      </view>

      <view class="actions">
        <button class="action-btn" type="warn" @click="goToCreate">Make Blessing</button>
        <button class="action-btn" @click="goToWorks">My Works</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Mock global uni object
const uni = (window as any).uni

const userInfo = ref<any>(null)

onMounted(() => {
  const user = uni.getStorageSync('userInfo')
  if (user) {
    try {
      userInfo.value = JSON.parse(user)
    } catch (e) {
      console.error(e)
    }
  }
})

const handleLogin = () => {
  uni.navigateTo({ url: '/pages/login/index' })
}

const goToCreate = () => {
  if (!userInfo.value) {
    uni.navigateTo({ url: '/pages/login/index' })
    return
  }
  uni.navigateTo({ url: '/pages/profile/index' })
}

const goToWorks = () => {
  if (!userInfo.value) {
    uni.navigateTo({ url: '/pages/login/index' })
    return
  }
  uni.navigateTo({ url: '/pages/works/index' })
}

const fireworkStyle = (i: number) => {
  return {
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 50}%`,
    animationDelay: `${Math.random() * 2}s`
  }
}
</script>

<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(to bottom, #DC143C, #8B0000); /* China Red */
}

.animation-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.firework {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #FFD700;
  box-shadow: 0 0 10px #FFD700, 0 0 20px #FF4500;
  animation: explode 2s infinite ease-out;
}

@keyframes explode {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(3); opacity: 0; }
}

.zodiac-horse {
  position: absolute;
  font-size: 50px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: runAround 10s infinite linear;
}

@keyframes runAround {
  0% { transform: translate(-50%, -50%) rotate(0deg) translateX(120px) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg) translateX(120px) rotate(-360deg); }
}

.content {
  position: relative;
  z-index: 10;
  padding: 60px 20px;
  text-align: center;
}

.title {
  font-size: 36px;
  color: #FFD700;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  display: block;
  margin-bottom: 40px;
}

.user-info {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid #FFD700;
  margin-bottom: 15px;
  background-color: #fff;
}

.nickname {
  color: #fff;
  font-size: 20px;
  font-weight: 500;
}

.login-btn, .actions {
  margin-top: 60px;
  width: 100%;
}

.action-btn {
  margin-bottom: 20px;
  width: 80%;
}
</style>
