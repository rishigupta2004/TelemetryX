type RafCallback = () => void

interface RafManager {
  _callbacks: Map<string, RafCallback>
  _rafId: number | null
  register: (id: string, callback: RafCallback) => void
  unregister: (id: string) => void
  isRegistered: (id: string) => boolean
  _startLoop: () => void
}

export const rafManager: RafManager = {
  _callbacks: new Map<string, RafCallback>(),
  _rafId: null,
  
  register(id: string, callback: RafCallback): void {
    this._callbacks.set(id, callback)
    
    if (this._rafId === null) {
      this._startLoop()
    }
  },
  
  unregister(id: string): void {
    this._callbacks.delete(id)
    
    if (this._callbacks.size === 0 && this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  },
  
  isRegistered(id: string): boolean {
    return this._callbacks.has(id)
  },
  
  _startLoop(): void {
    const loop = () => {
      for (const callback of this._callbacks.values()) {
        callback()
      }
      
      if (this._callbacks.size > 0) {
        this._rafId = requestAnimationFrame(loop)
      } else {
        this._rafId = null
      }
    }
    
    this._rafId = requestAnimationFrame(loop)
  }
}
