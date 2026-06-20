<script setup lang="ts">
const isOpen = ref(false)

const closeModal = () => {
  isOpen.value = false
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && isOpen.value) {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown)
})
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    aria-label="About this page"
    title="About this page"
    @click="isOpen = true"
  >
    <font-awesome-icon icon="fa-solid fa-circle-info" />
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="About this page"
      @click.self="closeModal"
    >
      <div
        class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            About this page
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close"
            @click="closeModal"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
        <div class="text-slate-600 dark:text-slate-300">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
