import { MutableRefObject, useEffect, useState, useRef } from "react";

export function useVisibility(threshold: number): ({ref: MutableRefObject<null>, visible: boolean}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  const observer = useRef(
    new IntersectionObserver(
      (entries) => {
        setVisible(entries[0]?.isIntersecting ?? false);
      },
      { threshold }
    )
  );
  useEffect(() => {
    if (ref.current) {
      observer.current.observe(ref.current);
    }
    return () => {
      observer.current.disconnect();
    };
  }, [ref.current]);

  return {ref, visible}
}