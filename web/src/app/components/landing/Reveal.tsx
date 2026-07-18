'use client';

import React, { useEffect, useRef } from 'react';

type RevealProps = {
  children: React.ReactNode;
  /** Extra classes on the wrapper (keeps layout classes with the animated node). */
  className?: string;
  /** Stagger, in seconds, before this element animates in once it enters view. */
  delay?: number;
  /** Wrapper element tag. Defaults to a div. */
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Scroll-triggered reveal. Adds `is-visible` the first time the element enters
 * the viewport, driving the fade + slide-up motion defined in globals.css.
 * Honors prefers-reduced-motion by revealing immediately.
 */
export default function Reveal({ children, className = '', delay = 0, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            node.classList.add('is-visible');
            observer.disconnect();
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}s` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
