<template>
  <img class="uni-image" :src="src" :style="imageStyle" @click="$emit('click', $event)" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  src: string
  mode?: string
}>()
defineEmits(['click'])

const imageStyle = computed(() => {
  if (props.mode === 'widthFix') {
    return { height: 'auto', width: '100%' }
  }
  return {}
})
</script>
<style scoped>
.uni-image {
  display: inline-block;
}
</style>
