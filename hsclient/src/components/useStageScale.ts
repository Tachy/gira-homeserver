import { useEffect, useRef, useState } from 'react';

export function useStageScale(stageW: number, stageH: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const isPortrait = rect.width <= rect.height;
      const s = isPortrait ? rect.width / stageW : rect.height / stageH;
      setScale(Math.max(0.1, s));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageW, stageH]);

  return { containerRef, scale };
}
