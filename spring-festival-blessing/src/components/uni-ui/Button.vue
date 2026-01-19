<template>
  <button class="uni-button" :class="[type, size]" @click="$emit('click', $event)">
    <slot />
  </button>
</template>
<script setup lang="ts">
defineProps<{
  type?: 'primary' | 'default' | 'warn'
  size?: 'default' | 'mini'
}>()
defineEmits(['click'])
</script>
<style scoped>
.uni-button {
  display: block;
  margin-left: auto;
  margin-right: auto;
  padding-left: 14px;
  padding-right: 14px;
  box-sizing: border-box;
  font-size: 18px;
  text-align: center;
  text-decoration: none;
  line-height: 2.55555556;
  border-radius: 5px;
  overflow: hidden;
  color: #000000;
  background-color: #F8F8F8;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.uni-button.primary {
  background-color: #007aff;
  color: #ffffff;
}
.uni-button.warn {
  background-color: #e64340;
  color: #ffffff;
}
.uni-button.mini {
  display: inline-block;
  line-height: 2.3;
  font-size: 13px;
  padding: 0 1.34em;
}
</style>
