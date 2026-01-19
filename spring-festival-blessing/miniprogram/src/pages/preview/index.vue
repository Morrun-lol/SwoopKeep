<template>
  <view class="container">
    <view class="animation-stage">
      <view class="firework" v-for="i in 5" :key="i" :style="fireworkStyle(i)"></view>
      <image class="avatar-q" :src="workData.avatarUrl" mode="widthFix" />
      <view class="blessing-text" v-if="showText">{{ workData.blessingText }}</view>
    </view>
    
    <view class="controls">
      <button size="mini" @click="playAudio" v-if="workData.audioUrl">Play Voice</button>
      <button size="mini" @click="toggleText">Toggle Text</button>
    </view>

    <view class="actions">
      <button type="primary" @click="handleShare">Share to Friends</button>
      <button class="save-btn" @click="handleSave">Save Work</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'


const workData = ref<any>({})
const showText = ref(true)

onMounted(() => {
  const data = uni.getStorageSync('currentWork')
  if (data) {
    try {
      workData.value = JSON.parse(data)
    } catch (e) {
      console.error(e)
    }
  }
})

const playAudio = () => {
  if (workData.value.audioUrl) {
    const innerAudioContext = uni.createInnerAudioContext();
    innerAudioContext.src = workData.value.audioUrl;
    innerAudioContext.play();
  }
}

const toggleText = () => {
  showText.value = !showText.value
}

const handleShare = () => {
  uni.showToast({ title: '分享成功!' })
  // In real app: uni.shareAppMessage
}

const handleSave = () => {
  // Save to backend 'works' table
  // For now just toast
  uni.showToast({ title: '已保存到我的作品!' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/works/index' }) // Assume Works is tab or navigate
  }, 1000)
}

const fireworkStyle = (i: number) => {
  return {
    left: `${Math.random() * 80 + 10}%`,
    top: `${Math.random() * 50 + 10}%`,
    animationDelay: `${Math.random() * 2}s`
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(to bottom, #4a192c, #1a0b2e);
  display: flex;
  flex-direction: column;
}
.animation-stage {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
}
.avatar-q {
  width: 200px;
  z-index: 10;
  animation: float 3s ease-in-out infinite;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
  100% { transform: translateY(0px); }
}
.blessing-text {
  margin-top: 30px;
  color: #FFD700;
  font-size: 22px;
  font-weight: bold;
  text-align: center;
  padding: 20px;
  background: rgba(0,0,0,0.5);
  border-radius: 10px;
  border: 1px solid #FFD700;
  z-index: 10;
  max-width: 80%;
}
.controls {
  padding: 10px;
  display: flex;
  justify-content: center;
  gap: 20px;
  background: rgba(255,255,255,0.1);
}
.actions {
  padding: 20px;
  background: white;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.save-btn {
  background-color: #f8f8f8;
  color: #333;
}
.firework {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: gold;
  box-shadow: 0 0 10px gold;
  animation: explode 2s infinite ease-out;
}
@keyframes explode {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(4); opacity: 0; }
}
</style>
