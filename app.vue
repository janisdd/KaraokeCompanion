<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <header class="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <NuxtLink to="/" class="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <img src="/logo.png" alt="Karaoke Companion logo" class="h-8 w-8 md:h-9 md:w-9" />
          <span
            v-if="appVersion"
            class="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300"
          >
            v{{ appVersion }}
          </span>
          <span class="max-w-[60vw] truncate text-sm font-semibold text-slate-900 dark:text-slate-100 md:hidden">
            {{ pageTitle }}
          </span>
          <span class="hidden md:inline">Karaoke Companion</span>
        </NuxtLink>
        <nav class="hidden items-center gap-3 text-sm text-slate-600 dark:text-slate-300 md:flex">
          <NuxtLink
            to="/browseLocalSongsIndex"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Browse Songs
          </NuxtLink>
          <NuxtLink
            to="/markedSongsList"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Marked Songs
          </NuxtLink>
          <NuxtLink
            to="/browseOnlineSongsIndex"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Online Songs
          </NuxtLink>
          <NuxtLink
            to="/localSongsIntersect"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Spotify vs Local
          </NuxtLink>
          <NuxtLink
            to="/onlineSongsIntersect"
            class="rounded-full px-3 py-1 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Spotify vs Online
          </NuxtLink>

          <button
            type="button"
            class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Show QR code"
            title="Show QR code"
            @click="openQrModal"
          >
            <font-awesome-icon icon="fa-solid fa-qrcode" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleDarkMode"
          >
            <font-awesome-icon :icon="isDark ? 'sun' : 'moon'" class="h-4 w-4" />
          </button>
          <NuxtLink
            v-if="!loggedIn"
            to="/users/usersList"
            class="inline-flex rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Choose a user to log in"
            title="Choose a user to log in"
          >
            <font-awesome-icon icon="fa-solid fa-user-slash" class="h-4 w-4" />
          </NuxtLink>
          <div
            v-else
            data-user-menu
            class="relative"
          >
            <button
              type="button"
              class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              :aria-expanded="isUserMenuOpen"
              aria-haspopup="menu"
              :aria-label="loggedInUserName ? `Account: ${loggedInUserName}` : 'Account menu'"
              :title="loggedInUserName ? `Logged in as ${loggedInUserName}` : 'Account'"
              @click="toggleUserMenu"
            >
              <font-awesome-icon icon="fa-solid fa-user" class="h-4 w-4" />
            </button>
            <div
              v-if="isUserMenuOpen"
              class="absolute right-0 z-[60] mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              role="menu"
              aria-label="Account"
            >
              <div
                class="px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100"
                role="menuitem"
              >
                {{ loggedInUserName || 'User' }}
              </div>
              <div class="border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  role="menuitem"
                  @click="openUserSettings"
                >
                  Settings
                </button>
                <NuxtLink
                  to="/users/usersList"
                  class="block w-full px-3 py-2 text-left text-sm text-slate-700 no-underline hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  role="menuitem"
                  @click="closeMenusAfterUserNav"
                >
                  Users
                </NuxtLink>
                <button
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
                  role="menuitem"
                  :disabled="isLoggingOut"
                  @click="logout"
                >
                  {{ isLoggingOut ? 'Logging out…' : 'Log out' }}
                </button>
              </div>
            </div>
          </div>
        </nav>
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
          :aria-label="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
          :title="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <font-awesome-icon :icon="isMobileMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'" class="h-4 w-4" />
        </button>
      </div>
      <div
        v-if="isMobileMenuOpen"
        class="border-t border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:hidden"
      >
        <nav class="flex flex-col gap-2">
          <NuxtLink
            to="/browseLocalSongsIndex"
            class="rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
            @click="isMobileMenuOpen = false"
          >
            Browse Songs
          </NuxtLink>
          <NuxtLink
            to="/markedSongsList"
            class="rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
            @click="isMobileMenuOpen = false"
          >
            Marked Songs
          </NuxtLink>
          <NuxtLink
            to="/browseOnlineSongsIndex"
            class="rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
            @click="isMobileMenuOpen = false"
          >
            Online Songs
          </NuxtLink>
          <NuxtLink
            to="/localSongsIntersect"
            class="rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
            @click="isMobileMenuOpen = false"
          >
            Spotify vs Local
          </NuxtLink>
          <NuxtLink
            to="/onlineSongsIntersect"
            class="rounded-xl px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            active-class="bg-slate-900 text-white hover:bg-slate-900 hover:text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100"
            @click="isMobileMenuOpen = false"
          >
            Spotify vs Online
          </NuxtLink>
          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Show QR code"
              title="Show QR code"
              @click="openQrModal"
            >
              <font-awesome-icon icon="fa-solid fa-qrcode" class="h-4 w-4" />
            </button>
            <NuxtLink
              v-if="!loggedIn"
              to="/users/usersList"
              class="inline-flex rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Choose a user to log in"
              title="Choose a user to log in"
              @click="isMobileMenuOpen = false"
            >
              <font-awesome-icon icon="fa-solid fa-user-slash" class="h-4 w-4" />
            </NuxtLink>
            <div
              v-else
              data-user-menu
              class="relative"
            >
              <button
                type="button"
                class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                :aria-expanded="isUserMenuOpen"
                aria-haspopup="menu"
                :aria-label="loggedInUserName ? `Account: ${loggedInUserName}` : 'Account menu'"
                :title="loggedInUserName ? `Logged in as ${loggedInUserName}` : 'Account'"
                @click="toggleUserMenu"
              >
                <font-awesome-icon icon="fa-solid fa-user" class="h-4 w-4" />
              </button>
              <div
                v-if="isUserMenuOpen"
                class="absolute right-0 z-[60] mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                role="menu"
                aria-label="Account"
              >
                <div
                  class="px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100"
                  role="menuitem"
                >
                  {{ loggedInUserName || 'User' }}
                </div>
                <div class="border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    role="menuitem"
                    @click="openUserSettings"
                  >
                    Settings
                  </button>
                  <NuxtLink
                    to="/users/usersList"
                    class="block w-full px-3 py-2 text-left text-sm text-slate-700 no-underline hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    role="menuitem"
                    @click="closeMenusAfterUserNav"
                  >
                    Users
                  </NuxtLink>
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
                    role="menuitem"
                    :disabled="isLoggingOut"
                    @click="logout"
                  >
                    {{ isLoggingOut ? 'Logging out…' : 'Log out' }}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleDarkMode"
            >
              <font-awesome-icon :icon="isDark ? 'sun' : 'moon'" class="h-4 w-4" />
            </button>
          </div>
        </nav>
      </div>
    </header>

    <main class="pt-12">
      <NuxtPage :keepalive="true" />
    </main>

    <div
      v-if="isQrModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-6 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="QR code"
      @click.self="isQrModalOpen = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">App URL QR Code</h2>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close QR modal"
            @click="isQrModalOpen = false"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-5 flex flex-col gap-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
          <div class="flex flex-col gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Size</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="sizeOption in qrCodeSizeOptions"
                  :key="sizeOption.value"
                  type="button"
                  class="rounded-full px-3 py-1 text-xs font-semibold transition"
                  :class="sizeOption.value === qrCodeSize ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'"
                  @click="qrCodeSize = sizeOption.value"
                >
                  {{ sizeOption.label }}
                </button>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Error correction</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="levelOption in qrCodeErrorCorrectionOptions"
                  :key="levelOption.value"
                  type="button"
                  class="rounded-full px-3 py-1 text-xs font-semibold transition"
                  :class="levelOption.value === qrCodeErrorCorrectionLevel ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'"
                  @click="qrCodeErrorCorrectionLevel = levelOption.value"
                >
                  {{ levelOption.label }}
                </button>
              </div>
            </div>
          </div>
          <div class="flex flex-col items-center gap-4">
            <div
              v-if="isQrCodeLoading"
              :class="qrCodeSizeClass"
              class="flex items-center justify-center rounded-lg bg-white text-sm font-semibold uppercase tracking-wide text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500"
            >
              Generating...
            </div>
            <div
              v-else-if="qrCodeError"
              :class="qrCodeSizeClass"
              class="flex items-center justify-center rounded-lg bg-white text-sm font-semibold text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-300"
            >
              {{ qrCodeError }}
            </div>
            <div v-else-if="qrCodeDataUrl" class="flex flex-col items-center gap-3">
              <p class="text-slate-500 dark:text-slate-400">
                {{ qrCodeUrl }}
              </p>
              <img
                :src="qrCodeDataUrl"
                :alt="qrCodeUrl ? `QR code for ${qrCodeUrl}` : 'QR code'"
                :class="qrCodeSizeClass"
                class="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900"
              />
            </div>
            <div
              v-else
              :class="qrCodeSizeClass"
              class="flex items-center justify-center rounded-lg bg-white text-sm font-semibold uppercase tracking-wide text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500"
            >
              QR Code
            </div>
            <button
              type="button"
              class="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
              :disabled="!qrCodeDataUrl || isQrCodeLoading"
              @click="openQrPrintPage"
            >
              Open print page
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isUserSettingsModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="User settings"
      @click.self="closeUserSettingsModal"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Account
            </div>
            <div class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              User settings
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close user settings"
            :disabled="isSettingsThemeSaving"
            @click="closeUserSettingsModal"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <div
          v-if="userSettingsError"
          class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
        >
          {{ userSettingsError }}
        </div>

        <div
          v-if="isUserSettingsLoading"
          class="py-8 text-center text-slate-500 dark:text-slate-400"
        >
          Loading settings…
        </div>

        <div v-else-if="sessionUserProfile" class="space-y-4">
          <div class="space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
            <div
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {{ sessionUserProfile.name }}
            </div>
          </div>

          <div class="space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Marked songs</span>
            <div
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {{ sessionUserProfile.markedSongs.length }}
            </div>
          </div>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Theme</span>
            <select
              :value="sessionUserProfile.theme"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
              :disabled="isSettingsThemeSaving"
              @change="onUserSettingsThemeChange"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from "qrcode";
import type { QRCodeErrorCorrectionLevel } from "qrcode";
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { FrontendUiTheme, UserWithDir } from "~/helpers/usersIndexer"

ModuleRegistry.registerModules([AllCommunityModule]);

const runtimeConfig = useRuntimeConfig()
const defaultThemeDark = runtimeConfig.public.defaultThemeDark === true
const appVersion = runtimeConfig.public.appVersion
const { user, loggedIn, fetch: refetchUserSession } = useUserSession()
const loggedInUserName = computed(() => {
  const sessionUser = user.value
  if (!sessionUser || typeof sessionUser !== 'object' || !('name' in sessionUser)) {
    return ''
  }
  const name = (sessionUser as { name: unknown }).name
  return typeof name === 'string' ? name : ''
})
const themeCookie = useCookie<string | null>('theme')
const route = useRoute()
const pageTitle = computed(() => {
  const title = route.meta?.title
  if (typeof title === 'string' && title.trim()) {
    return title
  }
  return 'Karaoke Companion'
})
const isDark = useState(
  'isDarkMode',
  () => themeCookie.value === 'dark' || (themeCookie.value == null && defaultThemeDark)
)
const isQrModalOpen = ref(false)
const isUserMenuOpen = ref(false)
const isMobileMenuOpen = ref(false)
const isUserSettingsModalOpen = ref(false)
const sessionUserProfile = ref<UserWithDir | null>(null)
const isUserSettingsLoading = ref(false)
const isSettingsThemeSaving = ref(false)
const userSettingsError = ref<string | null>(null)

const getFetchErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") {
    return fallback
  }

  const fetchError = error as {
    data?: { message?: string }
    statusMessage?: string
    message?: string
  }

  return (
    fetchError.data?.message ||
    fetchError.statusMessage ||
    fetchError.message ||
    fallback
  )
}

const closeUserMenu = () => {
  isUserMenuOpen.value = false
}

const closeMenusAfterUserNav = () => {
  closeUserMenu()
  isMobileMenuOpen.value = false
}

const closeUserSettingsModal = () => {
  if (isSettingsThemeSaving.value) {
    return
  }

  isUserSettingsModalOpen.value = false
  userSettingsError.value = null
}

const loadUserSettings = async () => {
  if (!import.meta.client) {
    return
  }

  isUserSettingsLoading.value = true
  userSettingsError.value = null
  try {
    sessionUserProfile.value = await $fetch<UserWithDir>("/api/users/session-user")
  } catch (error) {
    sessionUserProfile.value = null
    userSettingsError.value = getFetchErrorMessage(error, "Failed to load user settings")
  } finally {
    isUserSettingsLoading.value = false
  }
}

const saveUserSettingsTheme = async (theme: FrontendUiTheme) => {
  if (!sessionUserProfile.value) {
    return
  }

  isSettingsThemeSaving.value = true
  userSettingsError.value = null
  try {
    const updated = await $fetch<UserWithDir>("/api/users/session-user-theme", {
      method: "PATCH",
      body: { theme },
    })
    sessionUserProfile.value = updated
    setTheme(theme === "dark")
  } catch (error) {
    userSettingsError.value = getFetchErrorMessage(error, "Failed to update theme")
  } finally {
    isSettingsThemeSaving.value = false
  }
}

const onUserSettingsThemeChange = (event: Event) => {
  const select = event.target as HTMLSelectElement | null
  if (!select) {
    return
  }

  const theme = select.value
  if (theme !== "dark" && theme !== "light") {
    return
  }

  void saveUserSettingsTheme(theme)
}

const openUserSettings = () => {
  closeUserMenu()
  isMobileMenuOpen.value = false
  userSettingsError.value = null
  isUserSettingsModalOpen.value = true
  void loadUserSettings()
}

const isLoggingOut = ref(false)

const logout = async () => {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  try {
    await $fetch('/api/users/logout', { method: 'POST' })
    await refetchUserSession()
    closeUserMenu()
    isUserSettingsModalOpen.value = false
  } finally {
    isLoggingOut.value = false
  }
}

const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

const openQrModal = () => {
  closeUserMenu()
  isUserSettingsModalOpen.value = false
  isQrModalOpen.value = true
}

const onDocumentPointerDownCloseUserMenu = (event: Event) => {
  if (!isUserMenuOpen.value || !import.meta.client) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  for (const root of document.querySelectorAll('[data-user-menu]')) {
    if (root.contains(target)) {
      return
    }
  }

  closeUserMenu()
}
const qrCodeDataUrl = ref<string | null>(null)
const qrCodeUrl = ref<string | null>(null)
const isQrCodeLoading = ref(false)
const qrCodeError = ref<string | null>(null)
const qrCodeSizeOptions = [
  { label: 'Small', value: 192 },
  { label: 'Medium', value: 256 },
  { label: 'Large', value: 320 },
]
const qrCodeErrorCorrectionOptions = [
  { label: 'Low', value: 'L' },
  { label: 'Medium', value: 'M' },
  { label: 'Quartile', value: 'Q' },
  // { label: 'High (H)', value: 'H' },
 ] as const
const qrCodeSize = ref(qrCodeSizeOptions[1].value)
const qrCodeErrorCorrectionLevel = ref<QRCodeErrorCorrectionLevel>(
  qrCodeErrorCorrectionOptions[1].value
)
const qrCodeSizeClass = computed(() => {
  switch (qrCodeSize.value) {
    case 192:
      return 'h-48 w-48'
    case 320:
      return 'h-80 w-80'
    default:
      return 'h-64 w-64'
  }
})

useHead({
  htmlAttrs: {
    class: computed(() => (isDark.value ? 'dark' : '')),
  },
})

const applyDarkClass = (value: boolean) => {
  if (!process.client) return
  document.documentElement.classList.toggle('dark', value)
}

const setTheme = (value: boolean) => {
  isDark.value = value
  themeCookie.value = value ? 'dark' : 'light'
  if (process.client) {
    localStorage.setItem('theme', value ? 'dark' : 'light')
  }
  applyDarkClass(value)
}

const initTheme = () => {
  if (!process.client) return
  const storedTheme = localStorage.getItem('theme')
  if (storedTheme === 'dark' || storedTheme === 'light') {
    setTheme(storedTheme === 'dark')
  } else {
    setTheme(defaultThemeDark)
  }
}

const applyThemeForLoggedInUser = async (): Promise<boolean> => {
  if (!process.client || !loggedIn.value) {
    return false
  }

  const sessionUser = user.value
  if (sessionUser && typeof sessionUser === "object") {
    const theme = (sessionUser as { theme?: unknown }).theme
    if (theme === "dark" || theme === "light") {
      setTheme(theme === "dark")
      return true
    }
  }

  try {
    const profile = await $fetch<UserWithDir>("/api/users/session-user")
    setTheme(profile.theme === "dark")
    return true
  } catch {
    return false
  }
}

const toggleDarkMode = () => {
  closeUserMenu()
  setTheme(!isDark.value)
}

const loadQrCode = async () => {
  if (!process.client) {
    return
  }

  isQrCodeLoading.value = true
  qrCodeError.value = null
  try {
    const response = await $fetch<{ url: string }>('/api/app-url')
    qrCodeUrl.value = response.url
    qrCodeDataUrl.value = await QRCode.toDataURL(response.url, {
      width: qrCodeSize.value,
      margin: 1,
      errorCorrectionLevel: qrCodeErrorCorrectionLevel.value,
    })
  } catch (error) {
    console.error('Failed to generate QR code', error)
    qrCodeError.value = 'Failed to generate QR code.'
    qrCodeDataUrl.value = null
  } finally {
    isQrCodeLoading.value = false
  }
}

const openQrPrintPage = () => {
  if (!process.client || !qrCodeDataUrl.value || !qrCodeUrl.value) {
    return
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    return
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QR Code for Karaoke</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex;
        justify-content: center;
      }
      .page {
        padding: 32px;
        text-align: center;
        display: grid;
        gap: 24px;
        justify-items: center;
      }
      .title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
      }
      .url {
        font-size: 14px;
        color: #0f172a;
        word-break: break-all;
      }
      .qr {
        display: block;
        width: ${qrCodeSize.value}px;
        height: ${qrCodeSize.value}px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="title">Karaoke</div>
      <div class="url">${qrCodeUrl.value}</div>
      <img class="qr" src="${qrCodeDataUrl.value}" alt="QR code" />
    </div>
  </body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
}

watch(loggedIn, (isLogged) => {
  if (!isLogged) {
    closeUserMenu()
    isUserSettingsModalOpen.value = false
    initTheme()
  }
})

watch(() => route.fullPath, () => {
  closeUserMenu()
  if (!isSettingsThemeSaving.value) {
    isUserSettingsModalOpen.value = false
  }
})

onMounted(async () => {
  await refetchUserSession()
  if (loggedIn.value) {
    const applied = await applyThemeForLoggedInUser()
    if (!applied) {
      initTheme()
    }
  } else {
    initTheme()
  }
  document.addEventListener('pointerdown', onDocumentPointerDownCloseUserMenu)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDownCloseUserMenu)
})

watch(isQrModalOpen, (isOpen) => {
  if (isOpen) {
    loadQrCode()
  }
})

watch([qrCodeSize, qrCodeErrorCorrectionLevel], () => {
  if (isQrModalOpen.value) {
    loadQrCode()
  }
})

</script>
