import React, { MutableRefObject, useEffect, useState, useRef, RefObject, useCallback, DependencyList } from "react";

/**
 * A hook for observing when an element is in the viewport
 * Attach the hook's ref to the element you wish to observe
 * Fires the given callback when visiblity changes
 * @param threshold How much the element should be in the viewport before being classified as visible. (0-1)
 * @param callback The callback to fire on visibility cahnge
 * @param singleShot If true, the callback will only fire once
 * @returns A ref to attach
 */
export function useVisibilityCallback<Element extends HTMLElement>(threshold: number, callback: (visible: boolean, boundingRect: DOMRect)=>void, dependencies: DependencyList, {singleShot, cleanup}: {singleShot: boolean, cleanup?: ()=>void})
  : RefObject<Element> {
  const firedVisible = useRef(false);
  const ref = useRef<Element>(null);
  const hookedCallback = useCallback(callback, dependencies)
  const observer = useRef(
    typeof window !== 'undefined' ? new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false
        hookedCallback(isVisible, entries[0].boundingClientRect)
        // setVisible(isVisible);
        if (isVisible) {
          firedVisible.current = true
          if (singleShot) {
            observer.current?.disconnect()
            observer.current = undefined
          }
        }
      },
      { threshold }
    ) : undefined
  );
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
  const [visibility, setVisibility] = useState({visible: false, boundingRect: new DOMRect()})
  const ref = useVisibilityCallback<Element>(threshold, (visible, boundingRect)=>setVisibility({visible, boundingRect}), [], { singleShot})
  return {ref, ...visibility}
}

export interface ScrollParams {x: number, y: number, boundingRect: DOMRect, ev: Event}

export function useVisibleScrollCallback<Element extends HTMLElement>(threshold: number,
  callback: (params: ScrollParams) => void,
  dependencies: DependencyList
) {
  let ref: React.RefObject<Element> = {current: null}
  let scrollRelativeBoundingRect: DOMRect
  let scrollListener = (ev: Event) => {
    callback({x: window.scrollX, y: window.scrollY, boundingRect: scrollRelativeBoundingRect, ev})
  }
  ref = useVisibilityCallback<Element>(threshold, (visible)=>{
    if (visible) {
      if (ref.current) {
        const clientBoundingRect = ref.current.getBoundingClientRect()
        scrollRelativeBoundingRect = new DOMRect(
          clientBoundingRect.x + window.scrollX,
          clientBoundingRect.y + window.scrollY,
          clientBoundingRect.width,
          clientBoundingRect.height
        )
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