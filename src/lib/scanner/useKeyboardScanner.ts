'use client';

import { useEffect, useRef } from 'react';

interface Options {
  enabled?: boolean;
  /** Largo mínimo del código para considerarlo un escaneo. */
  minLength?: number;
  /** Tiempo máximo (ms) entre teclas. Los escáneres "teclado" escriben muy rápido; una persona no. */
  maxGapMs?: number;
}

/**
 * Soporte para escáneres USB / Bluetooth en modo "teclado" (HID).
 * No necesitan drivers: el escáner "teclea" el código y termina con Enter (o Tab).
 * Se distingue de una persona escribiendo por la velocidad entre teclas.
 */
export function useKeyboardScanner(onScan: (code: string) => void, { enabled = true, minLength = 4, maxGapMs = 50 }: Options = {}) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let last = 0;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buffer.length >= minLength && now - last <= maxGapMs * 3) {
          e.preventDefault();
          e.stopPropagation();
          const code = buffer;
          buffer = '';
          // Si el escáner "tecleó" el código dentro de un campo de texto, lo quitamos del campo.
          const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value.endsWith(code)) {
            const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, el.value.slice(0, -code.length));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          cb.current(code);
          return;
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1) {
        if (now - last > maxGapMs) buffer = '';
        buffer += e.key;
        last = now;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled, minLength, maxGapMs]);
}
