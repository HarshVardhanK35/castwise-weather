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
/* Portrait frame: centred and larger, sitting just above the icon in the
   middle of the screen (auto margin above, fixed gap below). */
@container (max-aspect-ratio: 1/1) {
  .header-row {
    align-items: center;
    gap: 1cqw;
    margin-top: auto;
    margin-bottom: 9cqw;
  }
  .location {
    font-size: 9cqw;
  }
  .time {
    font-size: 3.8cqw;
  }
}
</style>
