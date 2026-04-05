<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label="User settings"
    @click.self="closeModal"
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
          @click="closeModal"
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

        <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:items-end">
          <div class="min-w-0 space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Marked songs</span>
            <div
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {{ sessionUserProfile.markedSongs.length }}
            </div>
          </div>
          <label class="block min-w-0 space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Theme</span>
            <select
              :value="sessionUserProfile.theme"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
              :disabled="isSettingsThemeSaving"
              @change="onThemeChange"
            >
              <option value="auto">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>

        <div class="space-y-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Log in on another device
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Scan this code to open the login link for your account on a phone or other browser.
            </p>
          </div>
          <div
            class="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div
              v-if="isLoginQrLoading"
              class="flex h-64 w-64 items-center justify-center rounded-lg bg-white text-sm font-semibold uppercase tracking-wide text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500"
            >
              Generating…
            </div>
            <div
              v-else-if="loginQrError"
              class="flex h-64 w-64 items-center justify-center rounded-lg bg-white px-3 text-center text-sm font-semibold text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-300"
            >
              {{ loginQrError }}
            </div>
            <div v-else-if="loginQrDataUrl && loginQrFullUrl" class="flex flex-col items-center gap-3">
              <p class="max-w-full break-all text-center text-xs text-slate-500 dark:text-slate-400">
                {{ loginQrFullUrl }}
              </p>
              <img
                :src="loginQrDataUrl"
                alt="QR code for login URL"
                class="h-64 w-64 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900"
              />
            </div>
            <div
              v-else
              class="flex h-64 w-64 items-center justify-center rounded-lg bg-white text-sm font-semibold uppercase tracking-wide text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500"
            >
              QR code
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QRCode from "qrcode"
import type { FrontendUiTheme, UserWithDir } from "~/helpers/usersIndexer"

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  themeSaved: [theme: FrontendUiTheme]
}>()

const sessionUserProfile = ref<UserWithDir | null>(null)
const isUserSettingsLoading = ref(false)
const isSettingsThemeSaving = ref(false)
const userSettingsError = ref<string | null>(null)

const loginQrDataUrl = ref<string | null>(null)
const loginQrFullUrl = ref<string | null>(null)
const isLoginQrLoading = ref(false)
const loginQrError = ref<string | null>(null)

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

const closeModal = () => {
  if (isSettingsThemeSaving.value) {
    return
  }

  open.value = false
  userSettingsError.value = null
  loginQrDataUrl.value = null
  loginQrFullUrl.value = null
  loginQrError.value = null
}

const loadLoginQr = async (userName: string) => {
  if (!import.meta.client) {
    return
  }

  isLoginQrLoading.value = true
  loginQrError.value = null
  try {
    const { url: baseUrl } = await $fetch<{ url: string }>("/api/app-url")
    const loginUrl = new URL("/api/users/login", baseUrl)
    loginUrl.searchParams.set("name", userName)
    loginUrl.searchParams.set("redirectTo", "/")
    const href = loginUrl.href
    if (!open.value) {
      return
    }

    loginQrFullUrl.value = href
    const dataUrl = await QRCode.toDataURL(href, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
    })
    if (!open.value) {
      return
    }

    loginQrDataUrl.value = dataUrl
  } catch (error) {
    console.error("Failed to generate login QR code", error)
    loginQrError.value = "Failed to generate QR code."
    loginQrDataUrl.value = null
    loginQrFullUrl.value = null
  } finally {
    isLoginQrLoading.value = false
  }
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
    emit("themeSaved", theme)
  } catch (error) {
    userSettingsError.value = getFetchErrorMessage(error, "Failed to update theme")
  } finally {
    isSettingsThemeSaving.value = false
  }
}

const onThemeChange = (event: Event) => {
  const select = event.target as HTMLSelectElement | null
  if (!select) {
    return
  }

  const theme = select.value
  if (theme !== "dark" && theme !== "light" && theme !== "auto") {
    return
  }

  void saveUserSettingsTheme(theme)
}

watch(open, (isOpen) => {
  if (isOpen) {
    userSettingsError.value = null
    loginQrDataUrl.value = null
    loginQrFullUrl.value = null
    loginQrError.value = null
    void loadUserSettings()
  }
})

watch(
  [open, sessionUserProfile, isUserSettingsLoading],
  () => {
    if (!open.value || isUserSettingsLoading.value || !sessionUserProfile.value?.name) {
      return
    }

    void loadLoginQr(sessionUserProfile.value.name)
  },
  { flush: "post" }
)
</script>
