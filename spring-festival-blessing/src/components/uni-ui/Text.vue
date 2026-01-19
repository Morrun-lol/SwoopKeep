<template>
  <span class="uni-text" @click="$emit('click', $event)">
    <slot />
  </span>
</template>
<script setup lang="ts">
defineEmits(['click'])
</script>
<style scoped>
.uni-text {
  display: inline;
}
</style>
