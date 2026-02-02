<script setup lang="ts">
import type { SongInfo } from "~~/types/song";

const props = defineProps<{
  activeSong: SongInfo;
  activeCoverUrl: string | null;
  currentTimeLabel: string;
  durationLabel: string;
  isActiveAudioPlaying: boolean;
  duration: number;
  progressPercent: number;
  playerTime: number;
  onScrollToSong: () => void;
  onTogglePlayback: (song: SongInfo) => void;
  onStopPlayback: () => void;
}>();

const emit = defineEmits<{
  "update:playerTime": [number];
}>();

const playerTimeModel = computed({
  get: () => props.playerTime,
  set: (value) => {
    emit("update:playerTime", value);
  },
});
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
  >
    <div class="mx-auto flex max-w-5xl flex-col gap-3 px-3 py-2 sm:px-6 sm:py-3">
      <div class="flex items-start gap-3">
        <div class="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
          <img
            v-if="activeCoverUrl"
            :src="activeCoverUrl"
            :alt="`${activeSong.title} cover`"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-500"
          >
            <font-awesome-icon icon="fa-solid fa-music" />
          </div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>Now playing</span>
                <button
                  type="button"
                  class="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Scroll to song in list"
                  title="Scroll to song in list"
                  @click="onScrollToSong"
                >
                  <font-awesome-icon icon="fa-solid fa-location-arrow" />
                </button>
              </div>
              <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {{ activeSong.title }} — {{ activeSong.artist }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {{ currentTimeLabel }} / {{ durationLabel }}
              </div>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                :aria-label="isActiveAudioPlaying ? 'Pause audio' : 'Play audio'"
                @click="onTogglePlayback(activeSong)"
              >
                <font-awesome-icon
                  :icon="isActiveAudioPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'"
                />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close audio player"
                @click="onStopPlayback"
              >
                <font-awesome-icon icon="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
          <input
            v-model.number="playerTimeModel"
            type="range"
            min="0"
            :max="duration || 0"
            step="0.1"
            class="player-range w-full"
            :disabled="!duration"
            :style="{ '--progress': `${progressPercent}%` }"
            aria-label="Audio progress"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-range {
  -webkit-appearance: none;
  appearance: none;
  height: 0.4rem;
  border-radius: 9999px;
  background: #e2e8f0;
  outline: none;
}

::global(.dark) .player-range {
  background: #334155;
}

.player-range::-webkit-slider-runnable-track {
  height: 0.4rem;
  border-radius: 9999px;
  background: linear-gradient(
    to right,
    #1f8dd6 0%,
    #1f8dd6 var(--progress, 0%),
    #e2e8f0 var(--progress, 0%),
    #e2e8f0 100%
  );
}

::global(.dark) .player-range::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    #1f8dd6 0%,
    #1f8dd6 var(--progress, 0%),
    #334155 var(--progress, 0%),
    #334155 100%
  );
}

.player-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 0;
  height: 0;
  border: none;
  box-shadow: none;
}

.player-range::-moz-range-track {
  height: 0.4rem;
  border-radius: 9999px;
  background: #e2e8f0;
}

::global(.dark) .player-range::-moz-range-track {
  background: #334155;
}

.player-range::-moz-range-thumb {
  width: 0;
  height: 0;
  border: none;
  background: transparent;
}

.player-range::-moz-range-progress {
  height: 0.4rem;
  border-radius: 9999px;
  background: #1f8dd6;
}

.player-range:disabled {
  background: #e2e8f0;
}

::global(.dark) .player-range:disabled {
  background: #334155;
}
</style>
