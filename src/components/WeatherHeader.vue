<script setup lang="ts">
defineProps<{
  locationName: string;
  dateText: string;
  timeText: string;
  fontWeight: number;
}>();
</script>

<template>
  <div class="header-row">
    <span class="location" :style="{ fontWeight }">{{ locationName }}</span>
    <span class="time">{{ dateText }} · {{ timeText }}</span>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  flex-direction: column;
  gap: 0.3cqw;
}
.location {
  font-size: 4.4cqw;
}
.time {
  font-size: 1.9cqw;
  color: var(--accent-200);
}
</style>
