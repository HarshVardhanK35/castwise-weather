<script setup lang="ts">
import { iconFor } from "../weatherIcons";
import type { ForecastDay } from "../weatherApi";

defineProps<{
  forecast: ForecastDay[];
  mediumWeight: number;
}>();
</script>

<template>
  <div class="forecast-row">
    <div
      v-for="(day, i) in forecast"
      :key="`${day.label}-${i}`"
      class="forecast-day"
      :class="{ 'is-today': day.label === 'Today' }"
    >
      <component :is="iconFor(day.code, day.isDay)" class="forecast-icon" />
      <div class="forecast-text">
        <span class="forecast-label">{{ day.label }}</span>
        <!-- Hourly entries (Today range) carry just one temperature, no
             loText — daily entries (3-Day/7-Day) show a real H/L pair,
             high highlighted, low dimmed. -->
        <span v-if="day.loText" class="forecast-hi" :style="{ fontWeight: mediumWeight }">
          H {{ day.hiText }}
        </span>
        <span v-if="day.loText" class="forecast-lo">L {{ day.loText }}</span>
        <span v-else class="forecast-hi" :style="{ fontWeight: mediumWeight }">{{ day.hiText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forecast-row {
  display: flex;
  justify-content: space-between;
  gap: 2.4cqw;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 2cqw;
}
.forecast-day {
  flex: none;
  display: flex;
  align-items: center;
  gap: 1cqw;
}
.forecast-icon {
  flex-shrink: 0;
  width: 3.4cqw;
  height: 3.4cqw;
}
.forecast-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.forecast-label {
  font-size: 1.6cqw;
  color: var(--accent-200);
}
.forecast-hi {
  font-size: 2.1cqw;
}
.forecast-lo {
  font-size: 1.8cqw;
  opacity: 0.6;
}
/* Portrait frame: each day becomes a centred column (icon over text) so the
   strip stays horizontal but readable. */
@container (max-aspect-ratio: 1/1) {
  .forecast-row {
    margin-top: auto;
    gap: 1cqw;
    padding-top: 4cqw;
  }
  /* Today's high/low is already under the temperature; dropping it gives the
     remaining days room (the 5-Day / 7-Day strips only; the hourly strip has
     no "Today" entry). */
  .forecast-day.is-today {
    display: none;
  }
  .forecast-day {
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 1.6cqw;
  }
  .forecast-icon {
    width: 8cqw;
    height: 8cqw;
  }
  .forecast-text {
    align-items: center;
    text-align: center;
  }
  .forecast-label {
    font-size: 3.2cqw;
  }
  .forecast-hi {
    font-size: 3.8cqw;
  }
  .forecast-lo {
    font-size: 3.2cqw;
  }
}
</style>
