import { ref } from 'vue'

const isTauri = ref(typeof window !== 'undefined' && '__TAURI__' in window)

function getTauri() {
  return (window as any).__TAURI__
}

export function useTauri() {
  return {
    isTauri,
    getTauri,
    async invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      const tauri = getTauri()
      if (tauri?.core) {
        return tauri.core.invoke(cmd, args)
      }
      throw new Error('Not in Tauri environment')
    },
    async listen(event: string, handler: (payload: any) => void) {
      const tauri = getTauri()
      if (tauri?.event) {
        return tauri.event.listen(event, handler)
      }
    },
  }
}