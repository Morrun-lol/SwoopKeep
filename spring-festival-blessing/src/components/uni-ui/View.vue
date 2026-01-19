<template>
  <div class="uni-view" :class="hoverClass" @click="$emit('click', $event)">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hoverClass?: string
}>()
defineEmits(['click'])
</script>

<style scoped>
.uni-view {
  display: block;
  box-sizing: border-box;
}
</style>
