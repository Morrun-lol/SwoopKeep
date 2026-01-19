<template>
  <view class="container">
    <!-- 1. Q-Version Avatar -->
    <view class="section">
      <text class="section-title">1. 制作Q版形象</text>
      <view class="avatar-area">
        <image class="preview-img" :src="avatarUrl" mode="aspectFit" @click="chooseImage" />
        <view class="styles">
          <view class="style-item" 
            v-for="s in styles" :key="s.value" 
            :class="{ active: currentStyle === s.value }"
            @click="currentStyle = s.value">
            <text>{{ s.label }}</text>
          </view>
        </view>
        <button size="mini" type="primary" @click="generateAvatar" :disabled="!tempImagePath">生成Q版头像</button>
      </view>
    </view>

    <!-- 2. Voice & Text -->
    <view class="section">
      <text class="section-title">2. 语音和祝福</text>
      <view class="input-area">
        <textarea class="text-input" v-model="blessingText" placeholder="请输入您的新春祝福..." />
        <view class="voice-controls">
          <button size="mini" @click="synthesizeVoice">合成语音</button>
        </view>
      </view>
    </view>

    <view class="footer">
      <button type="warn" @click="goToPreview">预览祝福效果</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'


const avatarUrl = ref('https://via.placeholder.com/150?text=Click+to+Upload')
const tempImagePath = ref('')
const currentStyle = ref('comic')
const blessingText = ref('Happy Chinese New Year! Wishing you prosperity and happiness!')
const audioUrl = ref('')

const styles = [
  { label: 'Comic', value: 'comic' },
  { label: '3D', value: '3d' },
  { label: 'Sketch', value: 'sketch' }
]

const chooseImage = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res: any) => {
      const filePath = res.tempFilePaths[0];
      avatarUrl.value = filePath;
      
      // #ifdef MP-WEIXIN
      uni.getFileSystemManager().readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (r: any) => {
          tempImagePath.value = 'data:image/jpeg;base64,' + r.data;
        }
      });
      // #endif
      
      // #ifndef MP-WEIXIN
      tempImagePath.value = filePath;
      // #endif
    }
  });
}

const generateAvatar = () => {
  if (!tempImagePath.value) return
  
  uni.showLoading({ title: '正在生成...' })
  uni.request({
    url: 'http://localhost:3001/api/avatar/generate',
    method: 'POST',
    data: {
      imageBase64: tempImagePath.value, // In real app, upload file first or send base64
      style: currentStyle.value,
      userId: uni.getStorageSync('userId')
    },
    success: (res: any) => {
      uni.hideLoading()
      if (res.data.avatarUrl) {
        avatarUrl.value = res.data.avatarUrl
        uni.showToast({ title: '生成成功!' })
      }
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ title: '生成失败' })
    }
  })
}

const synthesizeVoice = () => {
  uni.showLoading({ title: '正在合成...' })
  uni.request({
    url: 'http://localhost:3001/api/voice/synthesize',
    method: 'POST',
    data: {
      text: blessingText.value,
      voiceId: 'default'
    },
    success: (res: any) => {
      uni.hideLoading()
      if (res.data.audioUrl) {
        audioUrl.value = res.data.audioUrl
        uni.showToast({ title: '准备播放!' })
        // Play audio demo
        const innerAudioContext = uni.createInnerAudioContext();
        innerAudioContext.src = audioUrl.value;
        innerAudioContext.play();
      }
    }
  })
}

const goToPreview = () => {
  // Pass data via storage
  const workData = {
    avatarUrl: avatarUrl.value,
    blessingText: blessingText.value,
    audioUrl: audioUrl.value
  }
  uni.setStorageSync('currentWork', JSON.stringify(workData))
  uni.navigateTo({ url: '/pages/preview/index' })
}
</script>

<style scoped>
.container {
  padding: 20px;
}
.section {
  background: white;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
.section-title {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 15px;
  display: block;
  color: #333;
}
.avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.preview-img {
  width: 150px;
  height: 150px;
  border-radius: 10px;
  background: #f0f0f0;
  margin-bottom: 15px;
  border: 1px dashed #ccc;
}
.styles {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}
.style-item {
  padding: 6px 16px;
  border: 1px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
}
.style-item.active {
  background: #DC143C;
  color: white;
  border-color: #DC143C;
}
.input-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.text-input {
  width: 100%;
  height: 100px;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 10px;
  box-sizing: border-box;
  font-family: inherit;
}
.footer {
  margin-top: 20px;
}
</style>
