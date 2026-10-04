import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One-line clock name. The slot is wider than the old cap; type steps down
 * only when the name still overflows that slot.
 */
export function FitClockName({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(() => fit());

    const fit = () => {
      observer.disconnect();
      const max = 24;
      const min = 13;
      el.style.fontSize = `${max}px`;
      el.style.width = 'max-content';
      el.style.maxWidth = 'min(18rem, 34vw)';
      if (el.scrollWidth > el.clientWidth + 1) {
        const locked = el.clientWidth;
        el.style.width = `${locked}px`;
        let size = max;
        while (el.scrollWidth > el.clientWidth + 1 && size > min) {
          size -= 1;
          el.style.fontSize = `${size}px`;
        }
      }
      observer.observe(el);
    };

    fit();
    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={ref}
      className={cn(
        'mx-auto w-max max-w-[min(18rem,34vw)] overflow-hidden whitespace-nowrap text-center font-display text-2xl leading-none',
        className
      )}
    >
      {children}
    </div>
  );
}
