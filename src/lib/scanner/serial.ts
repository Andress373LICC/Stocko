/**
 * Escáneres en modo "puerto serie" (COM / USB-CDC). Requieren instalar el driver del fabricante
 * si el sistema no los reconoce. Usa la Web Serial API (Chrome / Edge en computadora).
 */
export function serialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export interface SerialScanner {
  close: () => Promise<void>;
}

export async function connectSerialScanner(onScan: (code: string) => void, baudRate = 9600): Promise<SerialScanner> {
  const nav = navigator as any;
  const port = await nav.serial.requestPort();
  await port.open({ baudRate });

  const decoder = new TextDecoderStream();
  const piped = port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();
  let buffer = '';
  let active = true;

  (async () => {
    try {
      while (active) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let idx: number;
        while ((idx = buffer.search(/[\r\n]/)) >= 0) {
          const code = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (code) onScan(code);
        }
      }
    } catch {
      /* puerto desconectado */
    }
  })();

  return {
    close: async () => {
      active = false;
      try { await reader.cancel(); } catch {}
      try { await piped; } catch {}
      try { await port.close(); } catch {}
    },
  };
}
