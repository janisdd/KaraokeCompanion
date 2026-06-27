const SEARCH_MIN_CHARS = 3

export const useSearchMinimumChars = () => {
  const minimumSearchChars = computed(() => SEARCH_MIN_CHARS)

  return {
    minimumSearchChars,
  }
}
