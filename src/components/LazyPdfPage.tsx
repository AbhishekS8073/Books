import React, { useEffect, useRef, useState } from 'react';

interface Props {
  pdfDataUrl: string;
  pageIndex: number;       // 0-based
  canvasWidth: number;
  canvasHeight: number;
  onImageReady: (pageIndex: number, dataUrl: string) => void;
  /** Already rendered image — skip rendering if provided */
  cachedImage: string | null;
}

/**
 * Renders a single PDF page lazily when it scrolls into view.
 * Uses IntersectionObserver so off-screen pages are not decoded.
 */
const LazyPdfPage: React.FC<Props> = ({
  pdfDataUrl, pageIndex, canvasWidth, canvasHeight, onImageReady, cachedImage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const renderedRef = useRef(false);

  // Observe visibility
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: '400px' }   // start loading 400px before visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render when visible and not yet rendered
  useEffect(() => {
    if (!visible || renderedRef.current || cachedImage) return;
    renderedRef.current = true;

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const byteString = atob(pdfDataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

        const pdf = await pdfjsLib.getDocument({ data: ia }).promise;
        const page = await pdf.getPage(pageIndex + 1);   // pdfjs is 1-based

        const viewport = page.getViewport({ scale: 1.5 });
        const scaleX = canvasWidth / viewport.width;
        const scaleY = canvasHeight / viewport.height;
        const scale = Math.min(scaleX, scaleY);
        const scaledViewport = page.getViewport({ scale: 1.5 * scale });

        const offscreen = document.createElement('canvas');
        offscreen.width = canvasWidth;
        offscreen.height = canvasHeight;
        const ctx = offscreen.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const offsetX = (canvasWidth - scaledViewport.width) / 2;
        const offsetY = (canvasHeight - scaledViewport.height) / 2;
        ctx.translate(offsetX, offsetY);
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

        const dataUrl = offscreen.toDataURL('image/jpeg', 0.85);
        onImageReady(pageIndex, dataUrl);
      } catch (err) {
        console.error(`LazyPdfPage: failed to render page ${pageIndex}`, err);
      }
    })();
  }, [visible, cachedImage, pdfDataUrl, pageIndex, canvasWidth, canvasHeight, onImageReady]);

  return (
    <div ref={containerRef} style={{ width: canvasWidth, height: canvasHeight, position: 'relative' }}>
      {cachedImage ? null : (
        !visible ? (
          /* Placeholder before page scrolls into view */
          <div
            style={{
              width: canvasWidth, height: canvasHeight,
              background: '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', fontSize: 13
            }}
          >
            Page {pageIndex + 1}
          </div>
        ) : (
          /* Rendering spinner */
          <div
            style={{
              width: canvasWidth, height: canvasHeight,
              background: '#f9fafb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 8, color: '#6b7280', fontSize: 12
            }}
          >
            <div className="animate-spin rounded-full border-2 border-blue-400 border-t-transparent w-8 h-8" />
            Rendering page {pageIndex + 1}…
          </div>
        )
      )}
    </div>
  );
};

export default LazyPdfPage;
