<template>
  <view class="container">
    <!-- 全屏背景图 (降级方案) -->
    <image class="full-bg" src="/static/background.png" mode="aspectFill" />
    
    <!-- 全屏背景视频 (使用网络地址，避免主包过大) -->
    <video 
      class="full-bg" 
      :class="{ 'video-hidden': !isVideoLoaded }"
      src="https://cloud.video.taobao.com/play/u/2216867375276/p/1/e/6/t/1/487309990597.mp4" 
      :controls="false" 
      :autoplay="true" 
      :loop="true" 
      :muted="true" 
      :show-center-play-btn="false" 
      :enable-progress-gesture="false" 
      object-fit="cover"
      initial-time="0"
      @play="onVideoPlay"
      @error="onVideoError"
    ></video>
    
    <!-- Animation Layer -->
    <view class="animation-bg">
      <view class="firework" v-for="i in 5" :key="i" :style="fireworkStyle(i)"></view>
      <!-- 替换原有的 Emoji 马，使用高性能 Sprite 动画组件 -->
      <view class="horse-wrapper">
        <HorseRunner :isPlaying="isPlaying" />
      </view>
    </view>

    <!-- Content Layer -->
    <!-- 标题单独放在顶部 -->
    <view class="header-top">
      <text class="title">春节祝福</text>
    </view>

    <!-- 按钮区域放在底部 -->
    <view class="content-bottom">
      <view class="user-info" v-if="userInfo">
        <image class="avatar" :src="userInfo.avatarUrl" mode="aspectFill" />
        <text class="nickname">{{ userInfo.nickName }}</text>
      </view>
      <view class="login-btn" v-else>
        <button class="action-btn" type="primary" @click="handleLogin">微信一键登录</button>
      </view>

      <view class="actions">
        <button class="control-btn" size="mini" @click="toggleAnimation">
          {{ isPlaying ? '暂停奔跑' : '继续奔跑' }}
        </button>
        <button class="action-btn" type="warn" @click="goToCreate">制作祝福</button>
        <button class="action-btn" @click="goToWorks">我的作品</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import HorseRunner from '../../components/HorseRunner.vue'

const isPlaying = ref(true)
const isVideoLoaded = ref(false)

const onVideoPlay = () => {
  console.log('Video started playing')
  isVideoLoaded.value = true
}

const onVideoError = (e: any) => {
  console.error('Video error:', e)
  // 视频出错时保持 false，这样就会显示底下的图片
}

const toggleAnimation = () => {
  isPlaying.value = !isPlaying.value
}

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
  background-color: #D82828; /* 图片主色调作为底色 */
}

.full-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  object-fit: cover; /* 确保视频填满屏幕 */
}

.animation-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
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

.horse-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600rpx;
  height: 600rpx;
  pointer-events: none;
}

.header-top {
  position: absolute;
  top: 10%; /* 标题上移 */
  width: 100%;
  text-align: center;
  z-index: 10;
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

.control-btn {
  margin-bottom: 20px;
  background: rgba(0,0,0,0.3);
  color: #FFD700;
  border: 1px solid #FFD700;
}

.action-btn {
  margin-bottom: 20px;
  width: 80%;
}
</style>
