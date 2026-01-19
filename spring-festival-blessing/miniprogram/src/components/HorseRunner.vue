<template>
  <view class="horse-container" :style="{ width: size + 'rpx', height: size + 'rpx' }">
    <!-- 奔跑的马 (Sprite Animation) -->
    <view 
      class="horse-sprite"
      :class="{ 'paused': !isPlaying }"
      :style="spriteStyle"
    ></view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  // 播放状态
  isPlaying: {
    type: Boolean,
    default: true
  },
  // 尺寸 (rpx)
  size: {
    type: Number,
    default: 600
  },
  // 动画速度 (ms per cycle)
  // 24fps, 8 frames = 333ms
  duration: {
    type: Number,
    default: 333 
  },
  // Sprite Sheet 图片地址
  // 实际开发中，请将生成的 8帧 奔跑马匹拼合成一张横向长图
  spriteImage: {
    type: String,
    default: '/static/horse-sprite-placeholder.png' 
  }
})

const spriteStyle = computed(() => {
  return {
    backgroundImage: `url(${props.spriteImage})`,
    animationDuration: `${props.duration}ms`
  }
})
</script>

<style scoped>
.horse-container {
  position: relative;
  margin: 0 auto;
  overflow: hidden;
  /* 居中定位 */
  display: flex;
  justify-content: center;
  align-items: center;
}

.bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 红色国潮背景装饰 */
  background: radial-gradient(circle, rgba(220, 20, 60, 0.2) 0%, rgba(220, 20, 60, 0) 70%);
  z-index: 1;
}

.horse-sprite {
  width: 100%;
  height: 100%;
  background-size: 800% 100%; /* 8帧横向拼合 */
  background-position: 0 0;
  background-repeat: no-repeat;
  z-index: 10;
  
  /* 核心动画：steps(8) 实现帧动画 */
  animation-name: run-animation;
  animation-timing-function: steps(8); 
  animation-iteration-count: infinite;
  
  /* 硬件加速优化 */
  transform: translate3d(0, 0, 0);
  will-change: background-position;
}

.horse-sprite.paused {
  animation-play-state: paused;
}

@keyframes run-animation {
  0% { background-position: 0 0; }
  100% { background-position: 100% 0; }
}
</style>
