import { useEffect, useState } from 'react';

/**
 * Altezza (in px) di un elemento, aggiornata quando cambia (ResizeObserver). Restituisce il ref da collegare
 * all'elemento e l'altezza, null finché l'elemento non c'è.
 */
export function useElementHeight<ElementType extends HTMLElement>() {
  const [element, setElement] = useState<ElementType | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.round(entry.borderBoxSize[0]?.blockSize ?? entry.target.getBoundingClientRect().height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { ref: setElement, height };
}
