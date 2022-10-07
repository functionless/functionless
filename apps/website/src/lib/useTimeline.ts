import { useEffect, useState } from "react"

/**
 * Timeline is simply mapping from keys to ms at which to trigger
 */
export type Timeline<K extends string> = Record<K, number>

/**
 * Given a timeline object, return a live state which represents which keys have elapsed
 * @param timeline Timeline to map
 * @returns List of keys which have elapsed
 */
export function useTimeline<K extends string>(timeline: Timeline<K>): K[] {
  const [state, setState] = useState<K[]>([])

  useEffect(()=>{
    const ids: NodeJS.Timeout[] = []
    Object.entries<number>(timeline).forEach(([k, v]) => {
      ids.push(setTimeout(()=>{
        //The list will be naturally sorted, as the shorter timeouts will trigger first
        setState(s => [...s, k as K])
      }, v))
    })
    return ()=>{
      ids.forEach((id) => {
        clearTimeout(id)
      })
    }
  }, [timeline])

  return state
}