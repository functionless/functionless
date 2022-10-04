import React, { useEffect, useState, useRef, RefObject, useCallback, DependencyList } from "react";

/**
 * A hook for observing when an element is in the viewport
 * Attach the hook's ref to the element you wish to observe
 * Fires the given callback when visiblity changes
 * @param threshold How much the element should be in the viewport before being classified as visible. (0-1)
 * @param callback The callback to fire on visibility cahnge
 * @param singleShot If true, the callback will only fire once
 * @returns A ref to attach
 */
export function useVisibilityCallback<Element extends HTMLElement>(threshold: number, callback: (visible: boolean)=>void, dependencies: DependencyList, {singleShot, cleanup}: {singleShot: boolean, cleanup?: ()=>void})
  : RefObject<Element> {
  const firedVisible = useRef(false);
  const ref = useRef<Element>(null);
  const hookedCallback = useCallback(callback, dependencies)
  const observer = useRef<IntersectionObserver>()
  useEffect(()=>{
    observer.current = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false
        hookedCallback(isVisible)
        if (isVisible) {
          firedVisible.current = true
          if (singleShot) {
            observer.current?.disconnect()
            observer.current = undefined
          }
        }
      },
      { threshold }
    )
  }, [])

  useEffect(() => {
    if (ref.current && !(singleShot && firedVisible.current)) {
      observer.current?.observe(ref.current);
    }
    return () => {
      observer.current?.disconnect();
      cleanup?.()
    };
  }, [ref.current, singleShot]);

  return ref
}

/**
 * A hook for observing when an element is in the viewport, and exporting the visibility state
 * Attach the hook's ref to the element you wish to observe
 * @param threshold How much the element should be in the viewport before being classified as visible. (0-1)
 * @param singleShot If true, the callback will only fire once
 * @returns A ref to attach, and visiblity state
 */
export function useVisibility<Element extends HTMLElement>(threshold: number, {singleShot}: {singleShot: boolean}) {
  const [visibility, setVisibility] = useState(false)
  const ref = useVisibilityCallback<Element>(threshold, (visible)=>{
    if (visibility !== visible) {
    setVisibility(visible)
    }
  }, [visibility], { singleShot})
  return {ref, visible: visibility}
}

export interface ScrollParams {x: number, y: number, boundingRect: DOMRect, ev: Event}

export function useVisibleScrollCallback<Element extends HTMLElement>(threshold: number,
  callback: (params: ScrollParams) => void,
  dependencies: DependencyList
) {
  let ref: React.RefObject<Element> = {current: null}
  let scrollListener: (ev: Event) => void
  ref = useVisibilityCallback<Element>(threshold, (visible)=>{
    if (visible) {
      if (ref.current) {
        scrollListener = (ev) => {
          callback({x: window.scrollX, y: window.scrollY, boundingRect: ref.current?.getBoundingClientRect() ?? new DOMRect(), ev})
        }
        window.addEventListener('scroll', scrollListener, {passive: true,})
      }
    } else {
      window.removeEventListener('scroll', scrollListener)
    }
  }, dependencies, {
    singleShot: false,
    cleanup: ()=> {
      window.removeEventListener('scroll', scrollListener)
    }
  })
  return ref
}

export function useVisibleScroll<Element extends HTMLElement>(threshold: number) {
  const [visibleScroll, setVisibleScroll] = useState({
    boundingRect: {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
    x: 0,
    y: 0
  })
  const ref = useVisibleScrollCallback<Element>(threshold, ({boundingRect, x, y})=>
    setVisibleScroll({boundingRect, x, y}), []
  )
  return {ref, ...visibleScroll}
}