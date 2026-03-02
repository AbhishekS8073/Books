import React, { useEffect, useRef, useState } from 'react';
import { StickyNote, X } from 'lucide-react';

interface Props {
  pdfDataUrl: string;
  pageIndex: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  active: boolean;
  onAddStickerFromSelection?: (text: string, region: { x: number; y: number; w: number; h: number }) => void;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

interface Popup {
  x: number; // px in viewport
  y: number;
  text: string;
  region: { x: number; y: number; w: number; h: number };
}

const PdfTextLayer: React.FC<Props> = ({
  pdfDataUrl, pageIndex, canvasWidth, canvasHeight, zoom, active, onAddStickerFromSelection
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<{ text: string; x: number; y: number; w: number; h: number; fs: number }[]>([]);
  const loadedRef = useRef<string>('');
  const [popup, setPopup] = useState<Popup | null>(null);

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
        const scale = Math.min(canvasWidth / viewport.width, canvasHeight / viewport.height);
        const scaledVP = page.getViewport({ scale });
        const offsetX = (canvasWidth - scaledVP.width) / 2;
        const offsetY = (canvasHeight - scaledVP.height) / 2;

        const content = await page.getTextContent();
        const mapped = (content.items as TextItem[])
          .filter(item => item.str && item.str.trim())
          .map(item => {
            const [, , , d, e, f] = item.transform;
            const fontSize = Math.abs(d) * scale;
            const canvasX = e * scale + offsetX;
            const canvasY = (viewport.height - f) * scale + offsetY - fontSize;
            return {
              text: item.str,
              x: canvasX,
              y: canvasY,
              w: item.width * scale,
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

  // Listen for mouseup to detect text selection
  useEffect(() => {
    if (!active) {
      setPopup(null);
      return;
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Small delay so the selection is committed
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          // Don't clear popup immediately — user might be clicking the popup button
          return;
        }
        const selectedText = selection.toString().trim();
        if (!selectedText) return;

        // Get bounding rect of the selection relative to the container
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        if (!rects.length) return;

        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();

        // Compute bounding box of all rects relative to canvas coords (unzoomed)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const r of Array.from(rects)) {
          const rx = (r.left - containerRect.left) / zoom;
          const ry = (r.top - containerRect.top) / zoom;
          const rr = (r.right - containerRect.left) / zoom;
          const rb = (r.bottom - containerRect.top) / zoom;
          minX = Math.min(minX, rx);
          minY = Math.min(minY, ry);
          maxX = Math.max(maxX, rr);
          maxY = Math.max(maxY, rb);
        }

        // Popup position: just above/below selection in viewport coords
        const lastRect = rects[rects.length - 1];
        const popupX = lastRect.left - containerRect.left;
        const popupY = lastRect.bottom - containerRect.top + 6;

        setPopup({
          x: popupX,
          y: popupY,
          text: selectedText,
          region: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        });

        e.stopPropagation();
      }, 10);
    };

    const container = containerRef.current;
    container?.addEventListener('mouseup', handleMouseUp);
    return () => container?.removeEventListener('mouseup', handleMouseUp);
  }, [active, zoom]);

  // Close popup if clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!popup) return;
      const container = containerRef.current;
      if (container && !container.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

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
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      {/* Invisible but selectable text spans */}
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
            color: active ? 'rgba(0,0,100,0.02)' : 'transparent',
            whiteSpace: 'pre',
            cursor: active ? 'text' : 'default',
            background: 'transparent',
          }}
        >
          {item.text}
        </span>
      ))}

      {/* Selection popup */}
      {popup && active && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(popup.x, canvasWidth * zoom - 220),
            top: popup.y,
            zIndex: 100,
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 bg-gray-900 text-white rounded-xl shadow-2xl px-2 py-1.5 text-xs">
            {/* Preview of selected text */}
            <span className="max-w-[120px] truncate text-gray-300 text-[10px] italic mr-1">
              "{popup.text.slice(0, 40)}{popup.text.length > 40 ? '…' : ''}"
            </span>
            <button
              className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-semibold px-2.5 py-1 rounded-lg text-[11px] transition-colors whitespace-nowrap"
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                onAddStickerFromSelection?.(popup.text, popup.region);
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            >
              <StickyNote size={11} />
              Add Sticker
            </button>
            <button
              className="p-0.5 rounded hover:bg-white/20 text-gray-400 ml-0.5"
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                window.getSelection()?.removeAllRanges();
                setPopup(null);
              }}
            >
              <X size={12} />
            </button>
          </div>
          {/* Arrow up */}
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: 16,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '6px solid #111827',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default PdfTextLayer;
