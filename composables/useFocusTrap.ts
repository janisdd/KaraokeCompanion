const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",")

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled"),
  )
}

/**
 * Keeps keyboard focus inside `rootRef` while `enabled` is true (Tab / Shift+Tab wrap).
 * Focuses the first focusable node when the trap activates; restores the previous focus when it deactivates.
 */
export function useFocusTrap(
  rootRef: Ref<HTMLElement | null>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  let previousActive: HTMLElement | null = null

  const onDocumentKeydown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") {
      return
    }
    const el = rootRef.value
    if (!el) {
      return
    }
    const focusables = getFocusableElements(el)
    if (focusables.length === 0) {
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (!el.contains(active)) {
      e.preventDefault()
      if (e.shiftKey) {
        last.focus()
      } else {
        first.focus()
      }
      return
    }
    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault()
        last.focus()
      }
    } else if (active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  watch(
    () => toValue(enabled),
    async (isEnabled, wasEnabled) => {
      if (isEnabled) {
        previousActive = document.activeElement as HTMLElement | null
        await nextTick()
        const el = rootRef.value
        if (!el) {
          return
        }
        const focusables = getFocusableElements(el)
        if (focusables.length > 0) {
          focusables[0].focus()
        }
        document.addEventListener("keydown", onDocumentKeydown, true)
      } else {
        document.removeEventListener("keydown", onDocumentKeydown, true)
        if (wasEnabled === true && previousActive && typeof previousActive.focus === "function") {
          previousActive.focus()
        }
        previousActive = null
      }
    },
    { flush: "post", immediate: true },
  )

  onScopeDispose(() => {
    document.removeEventListener("keydown", onDocumentKeydown, true)
  })
}
