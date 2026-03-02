import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Point, Stroke, TextBox, ImageObj, PageData, ToolType, EraserMode, PenStyle } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  pageData: PageData;
  onPageDataChange: (data: PageData) => void;
  activeTool: ToolType;
  onToolChange?: (t: ToolType) => void;
  penColor: string;
  penWidth: number;
  penStyle: PenStyle;
  penOpacity: number;
  highlighterColor: string;
  highlighterWidth: number;
  eraserMode: EraserMode;
  eraserWidth: number;
  pdfPageImage: string | null;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

export interface CanvasHandle {
  getCanvasDataUrl: () => string;
  copySelection: () => void;
  pasteSelection: () => void;
  deleteSelection: () => void;
}

const DrawingCanvas = forwardRef<CanvasHandle, Props>((
  { pageData, onPageDataChange, activeTool, onToolChange, penColor, penWidth, penStyle,
    penOpacity, highlighterColor, highlighterWidth, eraserMode, eraserWidth,
    pdfPageImage, canvasWidth, canvasHeight, zoom },
  ref
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const isDraggingRef = useRef(false);
  const [clipboard, setClipboard] = useState<{ strokes: Stroke[], textBoxes: TextBox[], images: ImageObj[] } | null>(null);
  const [textEditId, setTextEditId] = useState<string | null>(null);
  const resizingRef = useRef<{ id: string, type: 'textbox' | 'image', handle: string } | null>(null);
  const pdfImgRef = useRef<HTMLImageElement | null>(null);
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const selectionRectRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  const lassoPointsRef = useRef<Point[]>([]);
  const pageDataRef = useRef<PageData>(pageData);
  const [, forceUpdate] = useState(0);

  // text-tool drag: track start position to distinguish click vs drag
  const textDragRef = useRef(false);
  const textDragStartPosRef = useRef<Point | null>(null);
  const textDragConfirmedRef = useRef(false); // true once we've moved >4px

  useEffect(() => { pageDataRef.current = pageData; }, [pageData]);

  const getPos = useCallback((e: React.PointerEvent | PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // PointerEvent works for mouse, touch AND stylus (pen)
    // e.pressure: 0.5 for mouse/touch (no hardware), real value for stylus
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
      pressure,
    };
  }, [zoom]);

  // Load PDF image
  useEffect(() => {
    if (pdfPageImage) {
      const img = new Image();
      img.onload = () => { pdfImgRef.current = img; renderCanvas(); };
      img.onerror = () => { pdfImgRef.current = null; renderCanvas(); };
      img.src = pdfPageImage;
    } else {
      pdfImgRef.current = null;
      renderCanvas();
    }
  }, [pdfPageImage]);

  const getImageElement = useCallback((src: string): HTMLImageElement | null => {
    if (imgCacheRef.current.has(src)) return imgCacheRef.current.get(src)!;
    const img = new Image();
    img.onload = () => { imgCacheRef.current.set(src, img); renderCanvas(); };
    img.src = src;
    return null;
  }, []);

  const getStrokeWidth = useCallback((baseWidth: number, pressure: number, style: string): number => {
    switch (style) {
      case 'brush': return baseWidth * (0.3 + pressure * 1.4);
      case 'fountain': return baseWidth * (0.5 + pressure * 1.0);
      case 'ballpen': return baseWidth * 0.8;
      default: return baseWidth;
    }
  }, []);

  const drawSmoothStroke = useCallback((
    ctx: CanvasRenderingContext2D, points: Point[], color: string,
    width: number, opacity: number, tool: string
  ) => {
    if (points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;

    if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity;
      if (points.length === 2) {
        const w = getStrokeWidth(width, points[1].pressure || 0.5, tool);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          const w = getStrokeWidth(width, p0.pressure || 0.5, tool);
          ctx.lineWidth = w;
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
        const lastPt = points[points.length - 1];
        ctx.lineTo(lastPt.x, lastPt.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }, [getStrokeWidth]);

  const drawResizeHandles = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    const handles = [
      { px: x, py: y }, { px: x + w, py: y }, { px: x, py: y + h }, { px: x + w, py: y + h },
      { px: x + w / 2, py: y }, { px: x + w / 2, py: y + h },
      { px: x, py: y + h / 2 }, { px: x + w, py: y + h / 2 }
    ];
    handles.forEach(hp => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hp.px, hp.py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  };

  const drawImage = useCallback((ctx: CanvasRenderingContext2D, im: ImageObj) => {
    const img = getImageElement(im.src);
    if (!img) return;
    ctx.save();
    try {
      ctx.drawImage(img, im.cropX, im.cropY, im.cropW, im.cropH, im.x, im.y, im.width, im.height);
    } catch {
      ctx.drawImage(img, im.x, im.y, im.width, im.height);
    }
    if (selectedImageId === im.id) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(im.x - 2, im.y - 2, im.width + 4, im.height + 4);
      ctx.setLineDash([]);
      drawResizeHandles(ctx, im.x, im.y, im.width, im.height);
    }
    ctx.restore();
  }, [getImageElement, selectedImageId]);

  const drawTextBox = useCallback((ctx: CanvasRenderingContext2D, tb: TextBox) => {
    ctx.save();
    ctx.font = `${tb.italic ? 'italic ' : ''}${tb.bold ? 'bold ' : ''}${tb.fontSize}px ${tb.fontFamily}`;
    ctx.fillStyle = tb.color;
    ctx.textBaseline = 'top';

    const lines: string[] = [];
    tb.text.split('\n').forEach(line => {
      if (!line) { lines.push(''); return; }
      const words = line.split(' ');
      let cur = '';
      words.forEach(word => {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > tb.width - 12 && cur) {
          lines.push(cur); cur = word;
        } else { cur = test; }
      });
      lines.push(cur);
    });

    lines.forEach((line, i) => ctx.fillText(line, tb.x + 6, tb.y + 6 + i * (tb.fontSize + 4)));

    if (selectedTextId === tb.id) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(tb.x, tb.y, tb.width, tb.height);
      drawResizeHandles(ctx, tb.x, tb.y, tb.width, tb.height);
    } else {
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tb.x, tb.y, tb.width, tb.height);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }, [selectedTextId]);

  const getStrokeBounds = (stroke: Stroke) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    stroke.points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pd = pageDataRef.current;
    pd.images.filter(im => im.behindContent).forEach(im => drawImage(ctx, im));
    if (pdfImgRef.current) ctx.drawImage(pdfImgRef.current, 0, 0, canvas.width, canvas.height);
    pd.images.filter(im => !im.behindContent).forEach(im => drawImage(ctx, im));

    pd.strokes.forEach(stroke => {
      drawSmoothStroke(ctx, stroke.points, stroke.color, stroke.width, stroke.opacity, stroke.tool);
      if (selectedStrokeIds.includes(stroke.id)) {
        const b = getStrokeBounds(stroke);
        ctx.save();
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        ctx.setLineDash([]);
        drawResizeHandles(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        ctx.restore();
      }
    });

    pd.textBoxes.forEach(tb => {
      if (tb.id !== textEditId) {
        drawTextBox(ctx, tb);
      } else {
        ctx.save();
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
        ctx.strokeRect(tb.x, tb.y, tb.width, tb.height);
        ctx.restore();
      }
    });

    const sr = selectionRectRef.current;
    if (sr) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sr.x, sr.y, sr.w, sr.h);
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
      ctx.setLineDash([]);
      ctx.restore();
    }

    const lp = lassoPointsRef.current;
    if (lp.length > 2) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(lp[0].x, lp[0].y);
      lp.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(59,130,246,0.05)'; ctx.fill();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [pageData, selectedStrokeIds, selectedTextId, selectedImageId, textEditId, drawImage, drawSmoothStroke, drawTextBox]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const pointInRect = (px: number, py: number, rx: number, ry: number, rw: number, rh: number) => {
    const x1 = Math.min(rx, rx + rw), x2 = Math.max(rx, rx + rw);
    const y1 = Math.min(ry, ry + rh), y2 = Math.max(ry, ry + rh);
    return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  };

  const pointInPolygon = (px: number, py: number, polygon: Point[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  const getResizeHandle = (pos: Point, x: number, y: number, w: number, h: number): string | null => {
    const handles: Record<string, { px: number, py: number }> = {
      tl: { px: x, py: y }, tr: { px: x + w, py: y },
      bl: { px: x, py: y + h }, br: { px: x + w, py: y + h },
      tm: { px: x + w / 2, py: y }, bm: { px: x + w / 2, py: y + h },
      ml: { px: x, py: y + h / 2 }, mr: { px: x + w, py: y + h / 2 }
    };
    for (const [key, hp] of Object.entries(handles)) {
      if (Math.abs(pos.x - hp.px) < 10 && Math.abs(pos.y - hp.py) < 10) return key;
    }
    return null;
  };

  // Track which pointer we're following (ignore secondary fingers)
  const activePointerIdRef = useRef<number | null>(null);

  /* ─── POINTER DOWN ─────────────────────────────────────────────── */
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only track the first pointer (pen or first finger), ignore additional touches
    if (activePointerIdRef.current !== null && e.pointerType !== 'pen') return;
    // For pen (stylus) always update to latest pointer
    activePointerIdRef.current = e.pointerId;
    // Capture pointer so move/up fire even if stylus leaves canvas briefly
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    const pos = getPos(e);
    const pd = pageDataRef.current;

    // ── TEXT TOOL ──
    if (activeTool === 'text') {
      // Check if clicking on an existing text box
      const hit = pd.textBoxes.find(t => pointInRect(pos.x, pos.y, t.x, t.y, t.width, t.height));
      if (hit) {
        // Check resize handle first
        const handle = getResizeHandle(pos, hit.x, hit.y, hit.width, hit.height);
        if (handle) {
          resizingRef.current = { id: hit.id, type: 'textbox', handle };
          dragStartRef.current = pos;
          isDrawingRef.current = true;
          setSelectedTextId(hit.id);
          return;
        }
        // Start potential drag — we'll confirm drag only after moving >4px
        setSelectedTextId(hit.id);
        setTextEditId(null);
        dragStartRef.current = pos;
        textDragStartPosRef.current = pos;
        textDragRef.current = true;
        textDragConfirmedRef.current = false;
        isDraggingRef.current = false; // not yet confirmed
        isDrawingRef.current = true;
        return;
      }
      // Click on empty space → create new textbox, then switch to select
      const newTb: TextBox = {
        id: uuidv4(), x: pos.x - 110, y: pos.y - 20, width: 220, height: 80,
        text: '', fontSize: 16, fontFamily: 'Arial', color: penColor,
        bold: false, italic: false, editing: true
      };
      onPageDataChange({ ...pd, textBoxes: [...pd.textBoxes, newTb] });
      setSelectedTextId(newTb.id);
      setTextEditId(newTb.id);
      textDragRef.current = false;
      // Auto-switch to select tool after placing textbox
      onToolChange?.('select');
      return;
    }

    // ── SELECT / LASSO ──
    if (activeTool === 'select' || activeTool === 'lasso') {
      // Resize handle checks
      if (selectedTextId) {
        const tb = pd.textBoxes.find(t => t.id === selectedTextId);
        if (tb) {
          const handle = getResizeHandle(pos, tb.x, tb.y, tb.width, tb.height);
          if (handle) {
            resizingRef.current = { id: tb.id, type: 'textbox', handle };
            dragStartRef.current = pos; isDrawingRef.current = true; return;
          }
        }
      }
      if (selectedImageId) {
        const im = pd.images.find(i => i.id === selectedImageId);
        if (im) {
          const handle = getResizeHandle(pos, im.x, im.y, im.width, im.height);
          if (handle) {
            resizingRef.current = { id: im.id, type: 'image', handle };
            dragStartRef.current = pos; isDrawingRef.current = true; return;
          }
        }
      }

      // Already-selected items → drag
      if (selectedStrokeIds.length > 0) {
        for (const sid of selectedStrokeIds) {
          const s = pd.strokes.find(st => st.id === sid);
          if (s) {
            const b = getStrokeBounds(s);
            if (pointInRect(pos.x, pos.y, b.x - 10, b.y - 10, b.w + 20, b.h + 20)) {
              dragStartRef.current = pos; isDraggingRef.current = true; isDrawingRef.current = true; return;
            }
          }
        }
      }
      if (selectedTextId) {
        const tb = pd.textBoxes.find(t => t.id === selectedTextId);
        if (tb && pointInRect(pos.x, pos.y, tb.x, tb.y, tb.width, tb.height)) {
          dragStartRef.current = pos; isDraggingRef.current = true; isDrawingRef.current = true; return;
        }
      }
      if (selectedImageId) {
        const im = pd.images.find(i => i.id === selectedImageId);
        if (im && pointInRect(pos.x, pos.y, im.x, im.y, im.width, im.height)) {
          dragStartRef.current = pos; isDraggingRef.current = true; isDrawingRef.current = true; return;
        }
      }

      // Hit-test unselected objects
      const tb = pd.textBoxes.find(t => pointInRect(pos.x, pos.y, t.x, t.y, t.width, t.height));
      if (tb) {
        setSelectedTextId(tb.id); setSelectedStrokeIds([]); setSelectedImageId(null); setTextEditId(null);
        dragStartRef.current = pos; isDraggingRef.current = true; isDrawingRef.current = true;
        forceUpdate(n => n + 1); return;
      }
      const im = pd.images.find(i => pointInRect(pos.x, pos.y, i.x, i.y, i.width, i.height));
      if (im) {
        setSelectedImageId(im.id); setSelectedStrokeIds([]); setSelectedTextId(null); setTextEditId(null);
        dragStartRef.current = pos; isDraggingRef.current = true; isDrawingRef.current = true;
        forceUpdate(n => n + 1); return;
      }
      const hitStroke = pd.strokes.find(s => {
        for (let i = 1; i < s.points.length; i++) {
          if (distToSegment(pos.x, pos.y, s.points[i - 1].x, s.points[i - 1].y, s.points[i].x, s.points[i].y) < s.width + 8) return true;
        }
        return false;
      });
      if (hitStroke) {
        setSelectedStrokeIds([hitStroke.id]); setSelectedTextId(null); setSelectedImageId(null); setTextEditId(null);
        dragStartRef.current = pos; isDraggingRef.current = true; isDrawingRef.current = true;
        forceUpdate(n => n + 1); return;
      }

      // Start drag-select
      setSelectedStrokeIds([]); setSelectedTextId(null); setSelectedImageId(null); setTextEditId(null);
      dragStartRef.current = pos; isDrawingRef.current = true;
      if (activeTool === 'lasso') lassoPointsRef.current = [pos];
      forceUpdate(n => n + 1);
      return;
    }

    if (activeTool === 'image') return;

    isDrawingRef.current = true;
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      currentStrokeRef.current = [pos];
    } else if (activeTool === 'eraser') {
      eraseAt(pos);
    }
  };

  /* ─── POINTER MOVE ─────────────────────────────────────────────── */
  const handlePointerMove = (e: React.PointerEvent) => {
    // Ignore events from non-tracked pointers
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);

    if (resizingRef.current && dragStartRef.current) {
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;
      const pd = pageDataRef.current;
      if (resizingRef.current.type === 'textbox') {
        const tbs = pd.textBoxes.map(tb => {
          if (tb.id !== resizingRef.current!.id) return tb;
          let { x, y, width, height } = tb;
          const h = resizingRef.current!.handle;
          if (h.includes('r')) width += dx;
          if (h.includes('l')) { x += dx; width -= dx; }
          if (h.includes('b')) height += dy;
          if (h.includes('t')) { y += dy; height -= dy; }
          return { ...tb, x, y, width: Math.max(50, width), height: Math.max(30, height) };
        });
        onPageDataChange({ ...pd, textBoxes: tbs });
      } else {
        const imgs = pd.images.map(im => {
          if (im.id !== resizingRef.current!.id) return im;
          let { x, y, width, height } = im;
          const h = resizingRef.current!.handle;
          if (h.includes('r')) width += dx;
          if (h.includes('l')) { x += dx; width -= dx; }
          if (h.includes('b')) height += dy;
          if (h.includes('t')) { y += dy; height -= dy; }
          return { ...im, x, y, width: Math.max(20, width), height: Math.max(20, height) };
        });
        onPageDataChange({ ...pd, images: imgs });
      }
      dragStartRef.current = pos;
      return;
    }

    // Confirm text-tool drag after 4px movement
    if (activeTool === 'text' && textDragRef.current && !textDragConfirmedRef.current && textDragStartPosRef.current) {
      const dist = Math.hypot(pos.x - textDragStartPosRef.current.x, pos.y - textDragStartPosRef.current.y);
      if (dist > 4) {
        textDragConfirmedRef.current = true;
        isDraggingRef.current = true;
      }
    }

    if (isDraggingRef.current && dragStartRef.current) {
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;
      const pd = pageDataRef.current;
      let newData = { ...pd };
      if (selectedStrokeIds.length > 0) {
        newData.strokes = pd.strokes.map(s =>
          selectedStrokeIds.includes(s.id)
            ? { ...s, points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
            : s
        );
      }
      if (selectedTextId) {
        newData.textBoxes = pd.textBoxes.map(tb =>
          tb.id === selectedTextId ? { ...tb, x: tb.x + dx, y: tb.y + dy } : tb
        );
      }
      if (selectedImageId) {
        newData.images = pd.images.map(im =>
          im.id === selectedImageId ? { ...im, x: im.x + dx, y: im.y + dy } : im
        );
      }
      onPageDataChange(newData);
      dragStartRef.current = pos;
      return;
    }

    if (activeTool === 'select' && dragStartRef.current && !isDraggingRef.current) {
      selectionRectRef.current = {
        x: Math.min(dragStartRef.current.x, pos.x), y: Math.min(dragStartRef.current.y, pos.y),
        w: Math.abs(pos.x - dragStartRef.current.x), h: Math.abs(pos.y - dragStartRef.current.y)
      };
      renderCanvas(); return;
    }

    if (activeTool === 'lasso' && dragStartRef.current) {
      lassoPointsRef.current.push(pos); renderCanvas(); return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      // Use coalesced events for stylus — gives sub-frame accuracy
      const coalescedEvents = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [];
      if (coalescedEvents.length > 0) {
        coalescedEvents.forEach(ce => {
          const canvas = canvasRef.current!;
          const rect = canvas.getBoundingClientRect();
          const pressure = ce.pressure > 0 ? ce.pressure : 0.5;
          currentStrokeRef.current.push({
            x: (ce.clientX - rect.left) / zoom,
            y: (ce.clientY - rect.top) / zoom,
            pressure,
          });
        });
      } else {
        currentStrokeRef.current.push(pos);
      }
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d')!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        const tool = activeTool === 'highlighter' ? 'highlighter' : penStyle;
        const col = activeTool === 'highlighter' ? highlighterColor : penColor;
        const wid = activeTool === 'highlighter' ? highlighterWidth : penWidth;
        drawSmoothStroke(ctx, currentStrokeRef.current, col, wid, penOpacity, tool);
      }
    } else if (activeTool === 'eraser') {
      eraseAt(pos);
    }
  };

  const eraseAt = (pos: Point) => {
    const r = eraserWidth / 2;
    const pd = pageDataRef.current;
    let newStrokes = [...pd.strokes];
    if (eraserMode === 'stroke') {
      newStrokes = newStrokes.filter(s => {
        for (let i = 1; i < s.points.length; i++) {
          if (distToSegment(pos.x, pos.y, s.points[i - 1].x, s.points[i - 1].y, s.points[i].x, s.points[i].y) < r + s.width / 2) return false;
        }
        return true;
      });
    } else {
      newStrokes = newStrokes.flatMap(s => {
        let hit = false;
        for (let i = 1; i < s.points.length; i++) {
          if (distToSegment(pos.x, pos.y, s.points[i - 1].x, s.points[i - 1].y, s.points[i].x, s.points[i].y) < r + s.width / 2) { hit = true; break; }
        }
        if (!hit) return [s];
        const segs: Point[][] = []; let cur: Point[] = [];
        s.points.forEach(p => {
          if (Math.hypot(p.x - pos.x, p.y - pos.y) < r + s.width / 2) { if (cur.length > 1) segs.push(cur); cur = []; }
          else cur.push(p);
        });
        if (cur.length > 1) segs.push(cur);
        return segs.map(seg => ({ ...s, id: uuidv4(), points: seg }));
      });
    }
    if (newStrokes.length !== pd.strokes.length || newStrokes.some((s, i) => s !== pd.strokes[i])) {
      onPageDataChange({ ...pd, strokes: newStrokes });
    }
  };

  /* ─── POINTER UP ───────────────────────────────────────────────── */
  const handlePointerUp = (e: React.PointerEvent) => {
    // Ignore events from non-tracked pointers
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    e.preventDefault();

    if (resizingRef.current) {
      resizingRef.current = null; dragStartRef.current = null; isDrawingRef.current = false; return;
    }

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (activeTool === 'text' && textDragRef.current) {
        textDragRef.current = false;
        textDragConfirmedRef.current = false;
        textDragStartPosRef.current = null;
      }
      dragStartRef.current = null; isDrawingRef.current = false; return;
    }

    // Text tool: pointer-up without confirmed drag = single click on existing box → open editor
    if (activeTool === 'text' && textDragRef.current && !textDragConfirmedRef.current) {
      textDragRef.current = false;
      textDragConfirmedRef.current = false;
      textDragStartPosRef.current = null;
      isDrawingRef.current = false;
      dragStartRef.current = null;
      // open the text editor for the selected text box
      if (selectedTextId) setTextEditId(selectedTextId);
      return;
    }

    if (activeTool === 'select' && selectionRectRef.current) {
      const sr = selectionRectRef.current;
      const pd = pageDataRef.current;
      const ids = pd.strokes.filter(s => {
        const b = getStrokeBounds(s);
        return pointInRect(b.x + b.w / 2, b.y + b.h / 2, sr.x, sr.y, sr.w, sr.h);
      }).map(s => s.id);
      setSelectedStrokeIds(ids);
      selectionRectRef.current = null; isDrawingRef.current = false; dragStartRef.current = null;
      forceUpdate(n => n + 1); return;
    }

    if (activeTool === 'lasso' && lassoPointsRef.current.length > 2) {
      const lp = lassoPointsRef.current;
      const pd = pageDataRef.current;
      const ids = pd.strokes.filter(s => {
        const b = getStrokeBounds(s);
        return pointInPolygon(b.x + b.w / 2, b.y + b.h / 2, lp);
      }).map(s => s.id);
      setSelectedStrokeIds(ids);
      lassoPointsRef.current = []; isDrawingRef.current = false; dragStartRef.current = null;
      forceUpdate(n => n + 1); return;
    }

    if ((activeTool === 'pen' || activeTool === 'highlighter') && currentStrokeRef.current.length > 1) {
      const tool = activeTool === 'highlighter' ? 'highlighter' : penStyle;
      const col = activeTool === 'highlighter' ? highlighterColor : penColor;
      const wid = activeTool === 'highlighter' ? highlighterWidth : penWidth;
      const newStroke: Stroke = {
        id: uuidv4(), points: currentStrokeRef.current,
        color: col, width: wid,
        opacity: activeTool === 'highlighter' ? 0.4 : penOpacity,
        tool, compositeOp: 'source-over'
      };
      const pd = pageDataRef.current;
      onPageDataChange({ ...pd, strokes: [...pd.strokes, newStroke] });
      const overlay = overlayCanvasRef.current;
      if (overlay) overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
    }

    currentStrokeRef.current = []; isDrawingRef.current = false;
    dragStartRef.current = null; selectionRectRef.current = null;
  };

  /* ─── double-click on text box → open editor ──────────────────── */
  const handleDoubleClick = (e: React.PointerEvent) => {
    const pos = getPos(e);
    const pd = pageDataRef.current;
    if (activeTool === 'text' || activeTool === 'select') {
      const tb = pd.textBoxes.find(t => pointInRect(pos.x, pos.y, t.x, t.y, t.width, t.height));
      if (tb) { setTextEditId(tb.id); setSelectedTextId(tb.id); }
    }
  };

  /* ─── Copy / Paste / Delete ────────────────────────────────────── */
  const copySelection = useCallback(() => {
    const pd = pageDataRef.current;
    const strokes = pd.strokes.filter(s => selectedStrokeIds.includes(s.id));
    const textBoxes = selectedTextId ? pd.textBoxes.filter(t => t.id === selectedTextId) : [];
    const images = selectedImageId ? pd.images.filter(i => i.id === selectedImageId) : [];
    if (strokes.length || textBoxes.length || images.length) {
      setClipboard({ strokes: JSON.parse(JSON.stringify(strokes)), textBoxes: JSON.parse(JSON.stringify(textBoxes)), images: JSON.parse(JSON.stringify(images)) });
    }
  }, [selectedStrokeIds, selectedTextId, selectedImageId]);

  const pasteSelection = useCallback(() => {
    if (!clipboard) return;
    const pd = pageDataRef.current;
    const offset = 30;
    const newStrokes = clipboard.strokes.map(s => ({ ...s, id: uuidv4(), points: s.points.map(p => ({ ...p, x: p.x + offset, y: p.y + offset })) }));
    const newTbs = clipboard.textBoxes.map(t => ({ ...t, id: uuidv4(), x: t.x + offset, y: t.y + offset, editing: false }));
    const newImgs = clipboard.images.map(i => ({ ...i, id: uuidv4(), x: i.x + offset, y: i.y + offset }));
    onPageDataChange({ ...pd, strokes: [...pd.strokes, ...newStrokes], textBoxes: [...pd.textBoxes, ...newTbs], images: [...pd.images, ...newImgs] });
    setSelectedStrokeIds(newStrokes.map(s => s.id));
    if (newTbs.length) setSelectedTextId(newTbs[0].id);
    if (newImgs.length) setSelectedImageId(newImgs[0].id);
  }, [clipboard, onPageDataChange]);

  const deleteSelection = useCallback(() => {
    const pd = pageDataRef.current;
    let newData = { ...pd };
    if (selectedStrokeIds.length) newData.strokes = pd.strokes.filter(s => !selectedStrokeIds.includes(s.id));
    if (selectedTextId) { newData.textBoxes = pd.textBoxes.filter(t => t.id !== selectedTextId); if (textEditId === selectedTextId) setTextEditId(null); }
    if (selectedImageId) newData.images = pd.images.filter(i => i.id !== selectedImageId);
    onPageDataChange(newData);
    setSelectedStrokeIds([]); setSelectedTextId(null); setSelectedImageId(null);
  }, [selectedStrokeIds, selectedTextId, selectedImageId, textEditId, onPageDataChange]);

  useImperativeHandle(ref, () => ({ getCanvasDataUrl: () => canvasRef.current?.toDataURL('image/png') || '', copySelection, pasteSelection, deleteSelection }), [copySelection, pasteSelection, deleteSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textEditId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection();
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') { e.preventDefault(); copySelection(); }
        if (e.key === 'v') { e.preventDefault(); pasteSelection(); }
        if (e.key === 'x') { e.preventDefault(); copySelection(); deleteSelection(); }
      }
      if (e.key === 'Escape') { setSelectedStrokeIds([]); setSelectedTextId(null); setSelectedImageId(null); setTextEditId(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelection, pasteSelection, deleteSelection, textEditId]);

  const getCursor = () => {
    if (isDraggingRef.current || (activeTool === 'text' && textDragConfirmedRef.current)) return 'grabbing';
    switch (activeTool) {
      case 'pen': case 'highlighter': return 'crosshair';
      case 'eraser': return 'cell';
      case 'select': case 'lasso': return 'default';
      case 'text': return selectedTextId ? 'move' : 'text';
      case 'image': return 'copy';
      case 'pan': return 'grab';
      case 'pdfselect': return 'text';
      default: return 'default';
    }
  };

  return (
    <div className="relative" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight}
        style={{ width: canvasWidth * zoom, height: canvasHeight * zoom, position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={overlayCanvasRef} width={canvasWidth} height={canvasHeight}
        style={{ width: canvasWidth * zoom, height: canvasHeight * zoom, position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      <div
        style={{ width: canvasWidth * zoom, height: canvasHeight * zoom, position: 'absolute', top: 0, left: 0, cursor: getCursor(), touchAction: 'none', userSelect: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={e => { if (isDrawingRef.current) handlePointerUp(e); }}
        onDoubleClick={e => {
          // handleDoubleClick expects PointerEvent-like, cast MouseEvent since it has same coords
          const fakePtr = { ...e, pressure: 0.5, pointerId: 0 } as unknown as React.PointerEvent;
          handleDoubleClick(fakePtr);
        }}
      />
      {/* pdfselect: invisible selectable text overlay handled by parent via PdfTextLayer */}
      {/* Inline textarea for text editing */}
      {pageData.textBoxes.filter(tb => tb.id === textEditId).map(tb => (
        <textarea
          key={tb.id}
          autoFocus
          value={tb.text}
          onChange={ev => {
            const newTbs = pageData.textBoxes.map(t => t.id === tb.id ? { ...t, text: ev.target.value } : t);
            onPageDataChange({ ...pageData, textBoxes: newTbs });
          }}
          onBlur={() => setTextEditId(null)}
          onKeyDown={ev => { if (ev.key === 'Escape') setTextEditId(null); ev.stopPropagation(); }}
          onClick={ev => ev.stopPropagation()}
          onMouseDown={ev => ev.stopPropagation()}
          style={{
            position: 'absolute',
            left: tb.x * zoom, top: tb.y * zoom,
            width: tb.width * zoom, height: tb.height * zoom,
            fontSize: tb.fontSize * zoom,
            fontFamily: tb.fontFamily, color: tb.color,
            fontWeight: tb.bold ? 'bold' : 'normal',
            fontStyle: tb.italic ? 'italic' : 'normal',
            background: 'rgba(255,255,255,0.97)',
            border: '2px solid #3b82f6', borderRadius: 4,
            outline: 'none', resize: 'none',
            padding: 6 * zoom, zIndex: 20, lineHeight: 1.3,
            boxShadow: '0 2px 12px rgba(59,130,246,0.15)'
          }}
        />
      ))}
      {/* Move hint label shown above selected textbox when using text tool */}
      {activeTool === 'text' && selectedTextId && !textEditId && (() => {
        const tb = pageData.textBoxes.find(t => t.id === selectedTextId);
        if (!tb) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: tb.x * zoom,
              top: Math.max(0, (tb.y - 26) * zoom),
              background: '#1d4ed8',
              color: '#fff',
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 4,
              userSelect: 'none',
              zIndex: 25,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ✥ drag to move · click to edit
          </div>
        );
      })()}
    </div>
  );
});

export default DrawingCanvas;
