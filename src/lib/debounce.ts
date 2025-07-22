export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeout: NodeJS.Timeout | null = null
  let promise: Promise<Awaited<ReturnType<T>>> | null = null
  let resolve: ((value: Awaited<ReturnType<T>>) => void) | null = null
  let reject: ((reason: any) => void) | null = null
  
  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    if (!promise) {
      promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
      })
    }
    
    timeout = setTimeout(async () => {
      try {
        const result = await func(...args)
        resolve!(result)
      } catch (error) {
        reject!(error)
      } finally {
        promise = null
        resolve = null
        reject = null
      }
    }, wait)
    
    return promise
  }
} 