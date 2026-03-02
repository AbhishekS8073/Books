import React, { useEffect, useRef, useState } from 'react';

interface Props {
  pdfDataUrl: string;
  pageIndex: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  active: boolean; // only interactive when pdfselect tool is active
}

interface TextItem {
  str: string;
  transform: number[]; // [a, b, c, d, e, f] — PDF transform matrix
  width: number;
  height: number;
  fontName: string;
}

const PdfTextLayer: React.FC<Props> = ({ pdfDataUrl, pageIndex, canvasWidth, canvasHeight, zoom, active }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<{ text: string; x: number; y: number; w: number; h: number; fs: number }[]>([]);
  const loadedRef = useRef<string>('');

  useEffect(() => {
    const key = `${pdfDataUrl.slice(0, 40)}_${pageIndex}`;
    if (loadedRef.current === key) return;
    loadedRef.current = key;

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
        if (pageIndex >= pdf.numPages) return;

        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });

        // Compute same scale used in renderPdfPages in App.tsx
        const scaleX = canvasWidth / viewport.width;
        const scaleY = canvasHeight / viewport.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledVP = page.getViewport({ scale });
        const offsetX = (canvasWidth - scaledVP.width) / 2;
        const offsetY = (canvasHeight - scaledVP.height) / 2;

        const content = await page.getTextContent();
        const mapped = (content.items as TextItem[])
          .filter(item => item.str && item.str.trim())
          .map(item => {
            // PDF matrix: [a, b, c, d, e, f]
            // e = x, f = y in PDF space (origin bottom-left)
            const [, , , d, e, f] = item.transform;
            const fontSize = Math.abs(d) * scale;
            // Convert PDF y (bottom-left origin) to canvas y (top-left origin)
            const canvasX = e * scale + offsetX;
            const canvasY = (viewport.height - f) * scale + offsetY - fontSize;
            const textWidth = item.width * scale;
            return {
              text: item.str,
              x: canvasX,
              y: canvasY,
              w: textWidth,
              h: fontSize * 1.2,
              fs: fontSize,
            };
          });

        setItems(mapped);
      } catch (err) {
        console.error('PdfTextLayer error:', err);
      }
    })();
  }, [pdfDataUrl, pageIndex, canvasWidth, canvasHeight]);

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth * zoom,
        height: canvasHeight * zoom,
        pointerEvents: active ? 'auto' : 'none',
        userSelect: active ? 'text' : 'none',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: item.x * zoom,
            top: item.y * zoom,
            width: item.w * zoom,
            fontSize: item.fs * zoom,
            lineHeight: 1.2,
            fontFamily: 'sans-serif',
            color: active ? 'rgba(0,0,100,0.01)' : 'transparent',
            whiteSpace: 'pre',
            cursor: active ? 'text' : 'default',
            // slight background on hover when active so user can see selectable zones
            background: 'transparent',
          }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
};

export default PdfTextLayer;
