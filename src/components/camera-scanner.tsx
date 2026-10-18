'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  /** Si es true, sigue escaneando sin cerrarse (útil en el punto de venta). */
  continuous?: boolean;
}

export function CameraScanner({ open, onClose, onDetected, continuous }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const detected = useRef(onDetected);
  detected.current = onDetected;

  useEffect(() => {
    if (!open) return;
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    let lastCode = '';
    let lastTime = 0;
    setError('');

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result) => {
          if (!result) return;
          const code = result.getText();
          const now = Date.now();
          if (code === lastCode && now - lastTime < 1800) return;
          lastCode = code;
          lastTime = now;
          detected.current(code);
          if (!continuous) onClose();
        });
        if (cancelled) controls.stop();
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Actívalo en la configuración del navegador.'
            : 'No se pudo abrir la cámara. Verifica que tu dispositivo tenga una y que estés usando HTTPS.'
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, continuous, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Escanear con la cámara">
      {error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          </div>
          <p className="mt-3 text-center text-sm text-slate-500">Apunta al código de barras o QR del producto.</p>
        </>
      )}
    </Modal>
  );
}
