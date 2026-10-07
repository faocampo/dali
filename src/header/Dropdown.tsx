import { useEffect, useRef, type ReactNode } from 'react';

/** Native disclosure with light dismissal and a stable dialog return target. */
export function Dropdown({ className, label, summary, children }: {
  className: string; label?: string; summary: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const panel = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const close = () => {
    if (panel.current) panel.current.open = false;
    trigger.current?.focus();
  };
  useEffect(() => {
    const outside = (event: Event) => {
      if (panel.current?.open && event.target instanceof Node && !panel.current.contains(event.target)) panel.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        event.preventDefault(); close();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return <details ref={panel} className={className}>
    <summary ref={trigger} aria-label={label}>{summary}</summary>
    <div>{children(close)}</div>
  </details>;
}
