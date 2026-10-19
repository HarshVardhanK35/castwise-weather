<script setup lang="ts">
import { iconFor } from "../weatherIcons";

const props = defineProps<{ conditionCode: number; isDay: boolean }>();
</script>

<template>
  <!-- Big background icon, representing the current condition, always
       dulled — purely decorative, sits behind everything else. -->
  <component :is="iconFor(props.conditionCode, props.isDay)" class="bg-icon" />
</template>

<style scoped>
.bg-icon {
  position: absolute;
  right: -2cqw;
  top: -4cqw;
  width: 40cqw;
  height: 40cqw;
  color: var(--accent-300);
  opacity: 0.22;
  pointer-events: none;
}
</style>
