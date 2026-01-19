<template>
  <view class="container">
    <view class="header">
      <text class="title">My Works</text>
    </view>
    <view class="works-list">
      <view class="work-item" v-for="(work, index) in works" :key="index" @click="openWork(work)">
        <image class="work-thumb" :src="work.avatarUrl" mode="aspectFill" />
        <text class="work-title">{{ work.blessingText ? work.blessingText.substring(0, 10) + '...' : 'Untitled' }}</text>
      </view>
      <view class="empty-tip" v-if="works.length === 0">
        <text>No works yet. Go create one!</text>
      </view>
    </view>
    <button class="back-btn" @click="goHome">Back to Home</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const uni = (window as any).uni
const works = ref<any[]>([])

onMounted(() => {
  // In real app, fetch from API /api/works/list
  // Here check storage or mock
  const current = uni.getStorageSync('currentWork')
  if (current) {
    try {
      // Just showing the last one for demo
      works.value = [JSON.parse(current)]
    } catch (e) {}
  }
})

const openWork = (work: any) => {
  uni.setStorageSync('currentWork', JSON.stringify(work))
  uni.navigateTo({ url: '/pages/preview/index' })
}

const goHome = () => {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style scoped>
.container {
  padding: 20px;
}
.header {
  margin-bottom: 20px;
  text-align: center;
}
.title {
  font-size: 20px;
  font-weight: bold;
}
.works-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}
.work-item {
  width: 45%;
  background: white;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  box-sizing: border-box;
}
.work-thumb {
  width: 100%;
  height: 100px;
  background: #eee;
  border-radius: 5px;
}
.work-title {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty-tip {
  width: 100%;
  text-align: center;
  color: #999;
  margin-top: 50px;
}
.back-btn {
  margin-top: 30px;
}
</style>
