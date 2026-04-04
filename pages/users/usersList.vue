<script setup lang="ts">
import type { FrontendUiTheme, UserWithDir } from "~/helpers/usersIndexer"

defineOptions({
  name: "UsersListPage",
})

definePageMeta({
  title: "Users",
})

type CreateUserRequest = {
  name: string
  theme: FrontendUiTheme
}

const defaultCreateForm = () => ({
  name: "",
  theme: "dark" as FrontendUiTheme,
})

const { data: usersResponse, pending, error, refresh } =
  await useFetch<UserWithDir[]>("/api/users/users")

const { user: sessionUserRef } = useUserSession()
const loggedInUserName = computed(() => {
  const sessionUser = sessionUserRef.value
  if (!sessionUser || typeof sessionUser !== "object" || !("name" in sessionUser)) {
    return ""
  }

  const name = (sessionUser as { name: unknown }).name
  return typeof name === "string" ? name : ""
})

const searchQuery = ref("")
const isCreateModalOpen = ref(false)
const isCreatingUser = ref(false)
const createUserErrorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const createForm = ref(defaultCreateForm())

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

const users = computed(() => {
  return [...(usersResponse.value ?? [])].sort((left, right) => {
    return left.name.localeCompare(right.name)
  })
})

const normalizedSearchQuery = computed(() => {
  return searchQuery.value.trim().toLowerCase()
})

const filteredUsers = computed(() => {
  if (!normalizedSearchQuery.value) {
    return users.value
  }

  return users.value.filter((user) => {
    const searchableValues = [user.name, user.userDirName, user.theme]

    return searchableValues
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchQuery.value)
  })
})

const usersLoadErrorMessage = computed(() => {
  if (!error.value) {
    return null
  }

  return getFetchErrorMessage(error.value, "Failed to load users")
})

const closeCreateModal = () => {
  if (isCreatingUser.value) {
    return
  }

  isCreateModalOpen.value = false
  createUserErrorMessage.value = null
  createForm.value = defaultCreateForm()
}

const openCreateModal = () => {
  successMessage.value = null
  createUserErrorMessage.value = null
  createForm.value = defaultCreateForm()
  isCreateModalOpen.value = true
}

const createUser = async () => {
  if (isCreatingUser.value) {
    return
  }

  const payload: CreateUserRequest = {
    name: createForm.value.name.trim(),
    theme: createForm.value.theme,
  }

  createUserErrorMessage.value = null
  successMessage.value = null
  isCreatingUser.value = true

  try {
    const createdUser = await $fetch<UserWithDir>("/api/users/create-user", {
      method: "POST",
      body: payload,
    })

    await refresh()
    successMessage.value = `User '${createdUser.name}' created`
    isCreateModalOpen.value = false
    createForm.value = defaultCreateForm()
  } catch (error) {
    createUserErrorMessage.value = getFetchErrorMessage(error, "Failed to create user")
  } finally {
    isCreatingUser.value = false
  }
}

const loginAsUser = (name: string) => {
  if (!import.meta.client) {
    return
  }

  const url = `/api/users/login?name=${encodeURIComponent(name)}`
  window.location.assign(url)
}
</script>

<template>
  <main class="box-border min-h-[calc(100vh-3rem)] bg-slate-50 px-3 pb-8 pt-6 sm:px-6 sm:pt-8 dark:bg-slate-950">
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <header class="space-y-2">
        <h1 class="hidden text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:block">
          Users
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          Browse all users, filter the list, and create new users.
        </p>
      </header>

      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label
          class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <span class="text-slate-500 dark:text-slate-400">Search</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Name, theme, or user dir"
            class="w-full border-none bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>

        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          @click="openCreateModal"
        >
          <font-awesome-icon icon="fa-solid fa-plus" />
          <span>Create user</span>
        </button>
      </div>

      <div
        v-if="successMessage"
        class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="usersLoadErrorMessage"
        class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
      >
        {{ usersLoadErrorMessage }}
      </div>

      <div
        v-else-if="pending"
        class="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        Loading users...
      </div>

      <section
        v-else
        class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <span>Showing {{ filteredUsers.length }} of {{ users.length }} users</span>
        </div>

        <div
          v-if="filteredUsers.length === 0"
          class="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
        >
          {{ users.length === 0 ? "No users found." : "No users match the current search." }}
        </div>

        <ul v-else class="divide-y divide-slate-200 dark:divide-slate-700">
          <li
            v-for="user in filteredUsers"
            :key="user.userDirName"
            class="px-4 py-4"
          >
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="min-w-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {{ user.name }}
                </h2>
                <button
                  v-if="loggedInUserName !== user.name"
                  type="button"
                  class="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  @click="loginAsUser(user.name)"
                >
                  Login
                </button>
                <span
                  v-else
                  class="inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400"
                >
                  Active
                </span>
              </div>

              <dl class="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    User dir
                  </dt>
                  <dd class="mt-1 break-all font-mono text-xs">
                    {{ user.userDirName }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Marked songs
                  </dt>
                  <dd class="mt-1">
                    {{ user.markedSongs.length }}
                  </dd>
                </div>
              </dl>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-if="isCreateModalOpen"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Create user"
      @click.self="closeCreateModal"
    >
      <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Users
            </div>
            <div class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Create user
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close create user modal"
            :disabled="isCreatingUser"
            @click="closeCreateModal"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Enter the details for the new user.
        </p>

        <div
          v-if="createUserErrorMessage"
          class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
        >
          {{ createUserErrorMessage }}
        </div>

        <form class="space-y-4" @submit.prevent="createUser">
          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
            <input
              v-model="createForm.name"
              type="text"
              autocomplete="off"
              placeholder="User name"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              User name may only contain characters matching
              <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-700 dark:bg-slate-800 dark:text-slate-300">[a-zA-Z0-9_-]</code>
              (letters, digits, underscore, hyphen).
            </p>
          </label>

          <label class="block space-y-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Theme</span>
            <select
              v-model="createForm.theme"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              :disabled="isCreatingUser"
              @click="closeCreateModal"
            >
              Abort
            </button>
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              :disabled="isCreatingUser"
            >
              <span
                v-if="isCreatingUser"
                class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-white dark:border-slate-400 dark:border-t-slate-900"
                aria-hidden="true"
              />
              <span>
                {{ isCreatingUser ? "Creating user" : "Create user" }}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
