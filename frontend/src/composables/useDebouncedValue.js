import { onBeforeUnmount, ref, watch } from 'vue'

export function useDebouncedValue(source, delay = 180) {
  const debounced = ref(source.value)
  let timeout = 0

  watch(source, (value) => {
    window.clearTimeout(timeout)
    timeout = window.setTimeout(() => {
      debounced.value = value
    }, delay)
  })

  onBeforeUnmount(() => {
    window.clearTimeout(timeout)
  })

  return debounced
}
