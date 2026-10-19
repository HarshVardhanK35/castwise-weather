<script setup lang="ts">
defineProps<{ status: "loading" | "error" }>();
</script>

<template>
  <div class="state-message">
    {{ status === "loading" ? "Loading…" : "Something went wrong on our end." }}
  </div>
</template>

<style scoped>
.state-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
}
</style>
