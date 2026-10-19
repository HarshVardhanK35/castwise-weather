<script setup lang="ts">
import { iconFor } from "../weatherIcons";
import type { WeatherData } from "../weatherApi";

defineProps<{
  weather: WeatherData;
  mediumWeight: number;
  lightWeight: number;
}>();
</script>

<template>
  <div class="main-row">
    <div class="temp" :style="{ fontWeight: lightWeight }">{{ weather.currentTempText }}</div>
    <div class="condition-col">
      <component :is="iconFor(weather.conditionCode, weather.isDay)" class="condition-icon" />
      <div class="condition">{{ weather.conditionText }}</div>
      <div v-if="weather.todayHiText" class="hi-lo">
        H {{ weather.todayHiText }} · L {{ weather.todayLoText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 3cqw;
}
.temp {
  font-size: 19cqw;
  line-height: 1;
}
.condition-col {
  display: flex;
  flex-direction: column;
  gap: 0.6cqw;
}
.condition-icon {
  width: 7cqw;
  height: 7cqw;
}
.condition {
  font-size: 2.8cqw;
}
.hi-lo {
  font-size: 2cqw;
  color: var(--accent-200);
}
</style>
