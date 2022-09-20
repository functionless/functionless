import { MutableRefObject, useEffect, useState, useRef } from "react";

/**
 * A hook for observing when an element is in the viewport
 * Attach the hook's ref to the element you wish to observe
 * @param threshold How much the element should be in the viewport before being classified as visible. (0-1)
 * @returns A ref to attach, and visibility state
 */
export function useVisibility(threshold: number, {singleShot}: {singleShot: boolean})
  : ({ref: MutableRefObject<null>, visible: boolean}) {
  const [visible, setVisible] = useState(false);
  const firedVisible = useRef(false);
  const ref = useRef(null);
  const observer = useRef(
    typeof window !== 'undefined' ? new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting ?? false
        setVisible(isVisible);
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
    };
  }, [ref.current, visible, singleShot]);

  return {ref, visible}
}