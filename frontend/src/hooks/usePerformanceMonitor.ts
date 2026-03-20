import { useEffect, useRef, useState, useCallback } from 'react'

export interface FPSDistribution {
  min: number
  max: number
  median: number
  p95: number
  p99: number
  mean: number
  variance: number
}

export interface RenderBudgetStatus {
  budgetMs: number
  averageMs: number
  percentageOverBudget: number
  framesOverBudget: number
}

export interface LongTaskInfo {
  duration: number
  timestamp: number
  frameTime: number
}

export interface MemoryStatus {
  usedMB: number
  totalMB: number
  growthRateMBPerMin: number
  isLeaking: boolean
}

export interface PerformanceWarning {
  type: 'fps' | 'frameTime' | 'memory' | 'longTask' | 'renderBudget'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: number
  value: number
  threshold: number
}

export interface OptimizationSuggestion {
  id: string
  category: 'rendering' | 'memory' | 'layout' | 'event' | 'general'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
}

export interface PerformanceHistoryEntry {
  timestamp: number
  fps: number
  avgFrameTime: number
  fpsDistribution: FPSDistribution
  renderBudget: RenderBudgetStatus
  memory: MemoryStatus
  longTasks: LongTaskInfo[]
}

export interface PerformanceMetrics {
  fps: number
  avgFrameTime: number
  frameDrops: number
  memory?: number
  fpsDistribution?: FPSDistribution
  renderBudget?: RenderBudgetStatus
  longTasks?: LongTaskInfo[]
  memoryStatus?: MemoryStatus
  warnings?: PerformanceWarning[]
  suggestions?: OptimizationSuggestion[]
  history?: PerformanceHistoryEntry[]
}

export interface UsePerformanceMonitorOptions {
  sampleInterval?: number
  onWarning?: (warning: PerformanceWarning) => void
  fpsWarningThreshold?: number
  enableLongTaskDetection?: boolean
  enableMemoryLeakDetection?: boolean
  enableRenderBudgetMonitoring?: boolean
  maxHistoryLength?: number
  longTaskThreshold?: number
  renderBudget?: number
  memoryLeakThreshold?: number
}

const DEFAULT_OPTIONS: Required<UsePerformanceMonitorOptions> = {
  sampleInterval: 1000,
  onWarning: () => {},
  fpsWarningThreshold: 55,
  enableLongTaskDetection: true,
  enableMemoryLeakDetection: true,
  enableRenderBudgetMonitoring: true,
  maxHistoryLength: 300,
  longTaskThreshold: 50,
  renderBudget: 16.67,
  memoryLeakThreshold: 10
}

function calculatePercentile(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0
  const index = Math.ceil((percentile / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, index)]
}

function calculateMean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function calculateVariance(arr: number[]): number {
  if (arr.length === 0) return 0
  const mean = calculateMean(arr)
  return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length
}

function analyzeFpsDistribution(frameTimes: number[]): FPSDistribution {
  if (frameTimes.length === 0) {
    return { min: 60, max: 60, median: 60, p95: 60, p99: 60, mean: 60, variance: 0 }
  }
  
  const fpsValues = frameTimes.map(t => t > 0 ? 1000 / t : 60)
  const sortedFps = [...fpsValues].sort((a, b) => a - b)
  
  return {
    min: Math.min(...sortedFps),
    max: Math.max(...sortedFps),
    median: calculatePercentile(sortedFps, 50),
    p95: calculatePercentile(sortedFps, 95),
    p99: calculatePercentile(sortedFps, 99),
    mean: calculateMean(fpsValues),
    variance: calculateVariance(fpsValues)
  }
}

function calculateRenderBudgetStatus(frameTimes: number[], budget: number): RenderBudgetStatus {
  if (frameTimes.length === 0) {
    return { budgetMs: budget, averageMs: budget, percentageOverBudget: 0, framesOverBudget: 0 }
  }
  
  const averageMs = calculateMean(frameTimes)
  const overBudgetFrames = frameTimes.filter(t => t > budget)
  const percentageOverBudget = (overBudgetFrames.length / frameTimes.length) * 100
  
  return {
    budgetMs: budget,
    averageMs,
    percentageOverBudget,
    framesOverBudget: overBudgetFrames.length
  }
}

function detectLongTasks(frameTimes: number[], threshold: number, maxTasks: number = 10): LongTaskInfo[] {
  const tasks: LongTaskInfo[] = []
  const now = Date.now()
  
  for (let i = 0; i < frameTimes.length; i++) {
    if (frameTimes[i] > threshold) {
      tasks.push({
        duration: frameTimes[i],
        timestamp: now - (frameTimes.length - i) * 16,
        frameTime: frameTimes[i]
      })
    }
  }
  
  return tasks.slice(-maxTasks)
}

function analyzeMemoryGrowth(memorySnapshots: { usedMB: number; totalMB: number; timestamp: number }[], threshold: number): MemoryStatus {
  if (memorySnapshots.length < 2) {
    return {
      usedMB: 0,
      totalMB: 0,
      growthRateMBPerMin: 0,
      isLeaking: false
    }
  }
  
  const latest = memorySnapshots[memorySnapshots.length - 1]
  const oldest = memorySnapshots[0]
  const timeDiffMinutes = (latest.timestamp - oldest.timestamp) / 60000
  
  if (timeDiffMinutes <= 0) {
    return {
      usedMB: latest.usedMB,
      totalMB: latest.totalMB,
      growthRateMBPerMin: 0,
      isLeaking: false
    }
  }
  
  const growthRate = (latest.usedMB - oldest.usedMB) / timeDiffMinutes
  
  return {
    usedMB: latest.usedMB,
    totalMB: latest.totalMB,
    growthRateMBPerMin: growthRate,
    isLeaking: growthRate > threshold
  }
}

function generateWarnings(
  fps: number,
  fpsDistribution: FPSDistribution,
  renderBudget: RenderBudgetStatus,
  memoryStatus: MemoryStatus,
  longTasks: LongTaskInfo[],
  fpsThreshold: number,
  longTaskThreshold: number
): PerformanceWarning[] {
  const warnings: PerformanceWarning[] = []
  const now = Date.now()
  
  if (fps < fpsThreshold) {
    warnings.push({
      type: 'fps',
      severity: fps < 30 ? 'critical' : fps < 45 ? 'high' : 'medium',
      message: `FPS dropped to ${fps} (threshold: ${fpsThreshold})`,
      timestamp: now,
      value: fps,
      threshold: fpsThreshold
    })
  }
  
  if (fpsDistribution.p99 < 30) {
    warnings.push({
      type: 'fps',
      severity: 'medium',
      message: `P99 FPS severely degraded: ${Math.round(fpsDistribution.p99)}`,
      timestamp: now,
      value: fpsDistribution.p99,
      threshold: 30
    })
  }
  
  if (renderBudget.percentageOverBudget > 50) {
    warnings.push({
      type: 'renderBudget',
      severity: renderBudget.percentageOverBudget > 80 ? 'critical' : 'high',
      message: `${Math.round(renderBudget.percentageOverBudget)}% of frames over ${renderBudget.budgetMs.toFixed(2)}ms budget`,
      timestamp: now,
      value: renderBudget.percentageOverBudget,
      threshold: 50
    })
  }
  
  if (memoryStatus.isLeaking) {
    warnings.push({
      type: 'memory',
      severity: 'high',
      message: `Potential memory leak detected: ${memoryStatus.growthRateMBPerMin.toFixed(2)} MB/min growth`,
      timestamp: now,
      value: memoryStatus.growthRateMBPerMin,
      threshold: 10
    })
  }
  
  if (longTasks.length > 0) {
    const worstTask = longTasks.reduce((worst, task) => 
      task.duration > worst.duration ? task : worst, longTasks[0])
    
    warnings.push({
      type: 'longTask',
      severity: worstTask.duration > 100 ? 'critical' : worstTask.duration > 75 ? 'high' : 'medium',
      message: `Long task detected: ${worstTask.duration.toFixed(2)}ms (threshold: ${longTaskThreshold}ms)`,
      timestamp: now,
      value: worstTask.duration,
      threshold: longTaskThreshold
    })
  }
  
  return warnings
}

function generateSuggestions(
  fpsDistribution: FPSDistribution,
  renderBudget: RenderBudgetStatus,
  memoryStatus: MemoryStatus,
  longTasks: LongTaskInfo[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  
  if (fpsDistribution.variance > 100) {
    suggestions.push({
      id: 'high-fps-variance',
      category: 'rendering',
      title: 'High FPS Variance',
      description: 'Frame times are inconsistent. Consider using requestAnimationFrame more efficiently or implementing frame pacing.',
      impact: 'high'
    })
  }
  
  if (renderBudget.framesOverBudget > 10) {
    suggestions.push({
      id: 'render-budget-issues',
      category: 'rendering',
      title: 'Render Budget Exceeded',
      description: ` ${renderBudget.framesOverBudget} frames exceeded the ${renderBudget.budgetMs.toFixed(2)}ms budget. Consider optimizing render cycles, using virtualization, or deferring non-critical updates.`,
      impact: 'high'
    })
  }
  
  if (memoryStatus.growthRateMBPerMin > 5) {
    suggestions.push({
      id: 'memory-growth',
      category: 'memory',
      title: 'Memory Growth Detected',
      description: 'Memory usage is growing over time. Check for event listener leaks, growing caches, or detached DOM references.',
      impact: 'medium'
    })
  }
  
  if (longTasks.length > 5) {
    suggestions.push({
      id: 'frequent-long-tasks',
      category: 'event',
      title: 'Frequent Long Tasks',
      description: `${longTasks.length} long tasks detected recently. Break up large synchronous operations using requestIdleCallback or web workers.`,
      impact: 'high'
    })
  }
  
  if (fpsDistribution.p95 < 30) {
    suggestions.push({
      id: 'p95-fps-degradation',
      category: 'rendering',
      title: 'P95 FPS Degradation',
      description: '5% of frames are running below 30 FPS. Profile components for optimization opportunities.',
      impact: 'high'
    })
  }
  
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'performance-ok',
      category: 'general',
      title: 'Performance Optimal',
      description: 'All performance metrics are within acceptable ranges. Continue monitoring.',
      impact: 'low'
    })
  }
  
  return suggestions
}

export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}): PerformanceMetrics {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const [metrics, setMetrics] = useState<PerformanceMetrics>({ 
    fps: 60, 
    avgFrameTime: 16.67, 
    frameDrops: 0 
  })
  
  const frameTimesRef = useRef<number[]>([])
  const memorySnapshotsRef = useRef<{ usedMB: number; totalMB: number; timestamp: number }[]>([])
  const lastTimeRef = useRef<number>(performance.now())
  const frameCountRef = useRef(0)
  const dropsRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const lastWarningRef = useRef(0)
  const historyRef = useRef<PerformanceHistoryEntry[]>([])
  const debugDataRef = useRef<PerformanceMetrics | null>(null)
  
  const getMemoryUsage = useCallback((): { usedMB: number; totalMB: number } | null => {
    if ('memory' in performance) {
      const mem = (performance as any).memory
      if (mem && mem.usedJSHeapSize) {
        return {
          usedMB: Math.round(mem.usedJSHeapSize / (1024 * 1024)),
          totalMB: Math.round(mem.jsHeapSizeLimit / (1024 * 1024))
        }
      }
    }
    return null
  }, [])
  
  useEffect(() => {
    let mounted = true
    
    const measureFrame = (timestamp: number) => {
      if (!mounted) return
      
      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp
      
      if (delta > 0) {
        const frameTime = delta
        frameTimesRef.current.push(frameTime)
        
        if (frameTimesRef.current.length > 120) {
          frameTimesRef.current.shift()
        }
        
        if (frameTime > 20) {
          dropsRef.current++
        }
      }
      
      frameCountRef.current++
      rafIdRef.current = requestAnimationFrame(measureFrame)
    }
    
    rafIdRef.current = requestAnimationFrame(measureFrame)
    
    const intervalId = setInterval(() => {
      if (!mounted) return
      
      const times = frameTimesRef.current
      if (times.length === 0) return
      
      const avgFrameTime = calculateMean(times)
      const fps = Math.round(1000 / avgFrameTime)
      const frameDrops = dropsRef.current
      
      const fpsDistribution = analyzeFpsDistribution(times)
      
      const renderBudget = opts.enableRenderBudgetMonitoring 
        ? calculateRenderBudgetStatus(times, opts.renderBudget)
        : { budgetMs: opts.renderBudget, averageMs: avgFrameTime, percentageOverBudget: 0, framesOverBudget: 0 }
      
      const longTasks = opts.enableLongTaskDetection
        ? detectLongTasks(times, opts.longTaskThreshold)
        : []
      
      let memoryUsage: number | undefined
      let memoryStatus: MemoryStatus | undefined
      
      if (opts.enableMemoryLeakDetection) {
        const mem = getMemoryUsage()
        if (mem) {
          memoryUsage = mem.usedMB
          memorySnapshotsRef.current.push({
            usedMB: mem.usedMB,
            totalMB: mem.totalMB,
            timestamp: Date.now()
          })
          
          if (memorySnapshotsRef.current.length > opts.maxHistoryLength) {
            memorySnapshotsRef.current.shift()
          }
          
          memoryStatus = analyzeMemoryGrowth(memorySnapshotsRef.current, opts.memoryLeakThreshold)
        }
      }
      
      const warnings = generateWarnings(
        fps,
        fpsDistribution,
        renderBudget,
        memoryStatus || { usedMB: 0, totalMB: 0, growthRateMBPerMin: 0, isLeaking: false },
        longTasks,
        opts.fpsWarningThreshold,
        opts.longTaskThreshold
      )
      
      const suggestions = generateSuggestions(fpsDistribution, renderBudget, memoryStatus || { usedMB: 0, totalMB: 0, growthRateMBPerMin: 0, isLeaking: false }, longTasks)
      
      const historyEntry: PerformanceHistoryEntry = {
        timestamp: Date.now(),
        fps,
        avgFrameTime,
        fpsDistribution,
        renderBudget,
        memory: memoryStatus || { usedMB: memoryUsage || 0, totalMB: 0, growthRateMBPerMin: 0, isLeaking: false },
        longTasks
      }
      
      historyRef.current.push(historyEntry)
      if (historyRef.current.length > opts.maxHistoryLength) {
        historyRef.current.shift()
      }
      
      const newMetrics: PerformanceMetrics = { 
        fps, 
        avgFrameTime, 
        frameDrops, 
        memory: memoryUsage,
        fpsDistribution,
        renderBudget,
        longTasks,
        memoryStatus,
        warnings,
        suggestions,
        history: [...historyRef.current]
      }
      
      setMetrics(newMetrics)
      debugDataRef.current = newMetrics
      
      if (warnings.length > 0) {
        const now = Date.now()
        const criticalWarning = warnings.find(w => w.severity === 'critical' || w.severity === 'high')
        if (criticalWarning && now - lastWarningRef.current > 5000) {
          lastWarningRef.current = now
          opts.onWarning(criticalWarning)
        }
      }
      
      dropsRef.current = 0
    }, opts.sampleInterval)
    
    if (typeof window !== 'undefined') {
      const exposeDebugData = () => {
        if (debugDataRef.current) {
          return debugDataRef.current
        }
        return null
      }
      
      const getHistory = () => {
        return [...historyRef.current]
      }
      
      const clearHistory = () => {
        historyRef.current = []
        memorySnapshotsRef.current = []
      }
      
      const getMetrics = () => {
        return {
          current: debugDataRef.current,
          history: getHistory(),
          clearHistory,
          exposeDebugData
        }
      }
      
      ;(window as any).__PERFORMANCE_MONITOR__ = getMetrics()
    }
    
    return () => {
      mounted = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      clearInterval(intervalId)
      if (typeof window !== 'undefined') {
        delete (window as any).__PERFORMANCE_MONITOR__
      }
    }
  }, [opts.sampleInterval, opts.onWarning, opts.fpsWarningThreshold, opts.enableLongTaskDetection, opts.enableMemoryLeakDetection, opts.enableRenderBudgetMonitoring, opts.longTaskThreshold, opts.renderBudget, opts.memoryLeakThreshold, opts.maxHistoryLength, getMemoryUsage])
  
  return metrics
}

export function useStableCallback<T extends (...args: any[]) => void>(callback: T): T {
  const ref = useRef(callback)
  
  useEffect(() => {
    ref.current = callback
  }, [callback])
  
  return ((...args: any[]) => ref.current(...args)) as T
}

export function useThrottle<T>(value: T, interval: number): T {
  const [throttled, setThrottled] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasChangedRef = useRef(false)
  const latestValueRef = useRef(value)
  
  useEffect(() => {
    latestValueRef.current = value
    hasChangedRef.current = true
    
    if (timeoutRef.current === null) {
      timeoutRef.current = setTimeout(() => {
        if (hasChangedRef.current) {
          setThrottled(latestValueRef.current)
        }
        timeoutRef.current = null
      }, interval)
    }
  }, [value, interval])
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return throttled
}

export function useDebounce<T>(value: T, interval: number): T {
  const [debounced, setDebounced] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  useEffect(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebounced(value)
    }, interval)
    
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, interval])
  
  return debounced
}
