import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ProjectFile, PageData, ToolType, EraserMode, PenStyle, SavedPen } from './types';
import { v4 as uuidv4 } from 'uuid';
import DocumentsPage from './components/DocumentsPage';
import Toolbar from './components/Toolbar';
import DrawingCanvas, { CanvasHandle } from './components/DrawingCanvas';
import { ArrowLeft } from 'lucide-react';
import PdfTextLayer from './components/PdfTextLayer';

const CANVAS_W = 1200;
const CANVAS_H = 900;

const emptyPage = (): PageData => ({ strokes: [], textBoxes: [], images: [] });

function App() {
  const [files, setFiles] = useState<ProjectFile[]>(() => {
    try {
      const saved = localStorage.getItem('drawboard_files_index');
      if (saved) {
        const index: ProjectFile[] = JSON.parse(saved);
        return index;
      }
      return [];
    } catch { return []; }
  });
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(3);
  const [penStyle, setPenStyle] = useState<PenStyle>('pen');
  const [penOpacity, setPenOpacity] = useState(1);
  const [highlighterColor, setHighlighterColor] = useState('#facc15');
  const [highlighterWidth, setHighlighterWidth] = useState(20);
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserWidth, setEraserWidth] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [savedPens, setSavedPens] = useState<SavedPen[]>(() => {
    try { const s = localStorage.getItem('drawboard_saved_pens'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [pdfPageImages, setPdfPageImages] = useState<Map<string, string[]>>(new Map());
  const [undoStack, setUndoStack] = useState<PageData[][]>([]);
  const [redoStack, setRedoStack] = useState<PageData[][]>([]);
  const [fileNameEdit, setFileNameEdit] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastUndoPushRef = useRef<number>(0);

  const activeFile = files.find(f => f.id === activeFileId) || null;

  // Save file index
  useEffect(() => {
    try {
      // Save index without pages data (too large)
      const index = files.map(f => ({
        ...f,
        pages: undefined,
        pdfDataUrl: undefined
      }));
      localStorage.setItem('drawboard_files_index', JSON.stringify(index));
    } catch { /* ignore */ }
  }, [files]);

  useEffect(() => {
    localStorage.setItem('drawboard_saved_pens', JSON.stringify(savedPens));
  }, [savedPens]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2000);
  };

  // Project load events (from file picker)
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail as ProjectFile;
      if (data && data.id) {
        setFiles(prev => {
          const exists = prev.find(f => f.id === data.id);
          if (exists) {
            return prev.map(f => f.id === data.id ? { ...data, updatedAt: Date.now() } : f);
          }
          return [...prev, { ...data, updatedAt: Date.now() }];
        });
        if (data.pdfDataUrl) {
          renderPdfPages(data.id, data.pdfDataUrl);
        }
        setActiveFileId(data.id);
        setUndoStack([]);
        setRedoStack([]);
        showStatus('Project loaded successfully!');
      }
    };
    window.addEventListener('loadProject', handler);
    return () => window.removeEventListener('loadProject', handler);
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<ProjectFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f));
  }, []);

  const handleNewNote = () => {
    const id = uuidv4();
    const file: ProjectFile = {
      id, name: 'Untitled Note', type: 'note',
      createdAt: Date.now(), updatedAt: Date.now(),
      pages: [emptyPage()], currentPage: 0, totalPages: 1
    };
    setFiles(prev => [...prev, file]);
    setActiveFileId(id);
    setUndoStack([]);
    setRedoStack([]);
  };

  const renderPdfPages = async (fileId: string, dataUrl: string) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

      const pdf = await pdfjsLib.getDocument({ data: ia }).promise;
      const images: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext('2d')!;
        // Scale to fit canvas
        const scaleX = CANVAS_W / viewport.width;
        const scaleY = CANVAS_H / viewport.height;
        const scale = Math.min(scaleX, scaleY);
        const scaledViewport = page.getViewport({ scale: 1.5 * scale });
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        // Center the PDF on canvas
        const offsetX = (CANVAS_W - scaledViewport.width) / 2;
        const offsetY = (CANVAS_H - scaledViewport.height) / 2;
        ctx.translate(offsetX, offsetY);
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.85));
      }

      setPdfPageImages(prev => new Map(prev).set(fileId, images));

      setFiles(prev => prev.map(f => {
        if (f.id === fileId) {
          const pages = f.pages.length >= pdf.numPages
            ? f.pages
            : Array.from({ length: pdf.numPages }, (_, i) => f.pages[i] || emptyPage());
          return { ...f, totalPages: pdf.numPages, pages };
        }
        return f;
      }));
      showStatus('PDF loaded successfully!');
    } catch (err) {
      console.error('PDF render error:', err);
      showStatus('Error loading PDF. Please try again.');
    }
  };

  const handleUploadPdf = async (file: File) => {
    const id = uuidv4();
    showStatus('Loading PDF...');
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const newFile: ProjectFile = {
        id, name: file.name.replace('.pdf', ''), type: 'pdf',
        createdAt: Date.now(), updatedAt: Date.now(),
        pages: [emptyPage()], pdfDataUrl: dataUrl,
        currentPage: 0, totalPages: 1
      };
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(id);
      setUndoStack([]);
      setRedoStack([]);
      await renderPdfPages(id, dataUrl);
    };
    reader.onerror = () => {
      showStatus('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleOpenFile = (id: string) => {
    setActiveFileId(id);
    setUndoStack([]);
    setRedoStack([]);
    // Re-render PDF if needed
    const f = files.find(fi => fi.id === id);
    if (f?.pdfDataUrl && !pdfPageImages.has(id)) {
      renderPdfPages(id, f.pdfDataUrl);
    }
  };

  const handleDeleteFile = (id: string) => {
    if (confirm('Delete this document?')) {
      setFiles(prev => prev.filter(f => f.id !== id));
      if (activeFileId === id) setActiveFileId(null);
    }
  };

  const handlePageDataChange = useCallback((data: PageData) => {
    if (!activeFileId) return;

    setFiles(prev => {
      const file = prev.find(f => f.id === activeFileId);
      if (!file) return prev;

      // Debounced undo push
      const now = Date.now();
      if (now - lastUndoPushRef.current > 500) {
        lastUndoPushRef.current = now;
        setUndoStack(us => [...us.slice(-30), JSON.parse(JSON.stringify(file.pages))]);
        setRedoStack([]);
      }

      const newPages = [...file.pages];
      newPages[file.currentPage] = data;
      return prev.map(f => f.id === activeFileId ? { ...f, pages: newPages, updatedAt: Date.now() } : f);
    });
  }, [activeFileId]);

  const handleUndo = () => {
    if (!activeFile || undoStack.length === 0) return;
    const prevPages = undoStack[undoStack.length - 1];
    setRedoStack(rs => [...rs, JSON.parse(JSON.stringify(activeFile.pages))]);
    setUndoStack(us => us.slice(0, -1));
    updateFile(activeFile.id, { pages: prevPages });
  };

  const handleRedo = () => {
    if (!activeFile || redoStack.length === 0) return;
    const nextPages = redoStack[redoStack.length - 1];
    setUndoStack(us => [...us, JSON.parse(JSON.stringify(activeFile.pages))]);
    setRedoStack(rs => rs.slice(0, -1));
    updateFile(activeFile.id, { pages: nextPages });
  };

  const handlePageChange = (page: number) => {
    if (!activeFile) return;
    if (page < 0 || page >= activeFile.totalPages) return;
    updateFile(activeFile.id, { currentPage: page });
  };

  const handleAddPage = () => {
    if (!activeFile) return;
    const newPages = [...activeFile.pages, emptyPage()];
    updateFile(activeFile.id, { pages: newPages, totalPages: newPages.length });
  };

  const handleSave = () => {
    if (!activeFile) return;
    try {
      const thumb = canvasRef.current?.getCanvasDataUrl();
      const fileToSave = { ...activeFile, thumbnail: thumb, updatedAt: Date.now() };
      updateFile(activeFile.id, { thumbnail: thumb });
      // Try localStorage - may fail for large files
      try {
        localStorage.setItem(`drawboard_file_${activeFile.id}`, JSON.stringify(fileToSave));
      } catch {
        // Storage full - that's OK, we still have it in memory
      }
      showStatus('Saved!');
    } catch {
      showStatus('Save failed');
    }
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const thumb = canvasRef.current?.getCanvasDataUrl();
    const fileToSave = { ...activeFile, thumbnail: thumb, updatedAt: Date.now() };
    const blob = new Blob([JSON.stringify(fileToSave)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile.name}.dbnotes`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Downloaded!');
  };

  const handleImageInsert = () => {
    imageInputRef.current?.click();
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const scale = Math.min(1, maxW / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        const newImg = {
          id: uuidv4(), x: 100, y: 100, width: w, height: h,
          src: reader.result as string, behindContent: false,
          cropX: 0, cropY: 0, cropW: img.naturalWidth, cropH: img.naturalHeight,
          naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight
        };
        const currentPageData = activeFile.pages[activeFile.currentPage] || emptyPage();
        handlePageDataChange({ ...currentPageData, images: [...currentPageData.images, newImg] });
        showStatus('Image inserted!');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSavePen = () => {
    const name = prompt('Pen name:', `${penStyle} ${penWidth}px`);
    if (!name) return;
    const pen: SavedPen = {
      id: uuidv4(), name, color: penColor, width: penWidth,
      tool: penStyle, opacity: penOpacity
    };
    setSavedPens(prev => [...prev, pen]);
    showStatus('Pen saved!');
  };

  const handleLoadPen = (pen: SavedPen) => {
    setPenColor(pen.color);
    setPenWidth(pen.width);
    setPenStyle(pen.tool as PenStyle);
    setPenOpacity(pen.opacity);
    setActiveTool('pen');
    showStatus(`Loaded: ${pen.name}`);
  };

  const handleDeletePen = (id: string) => {
    setSavedPens(prev => prev.filter(p => p.id !== id));
  };

  const handleBack = () => {
    handleSave();
    setActiveFileId(null);
  };

  // Documents view
  if (!activeFile) {
    return (
      <DocumentsPage
        files={files}
        onOpenFile={handleOpenFile}
        onNewNote={handleNewNote}
        onUploadPdf={handleUploadPdf}
        onDeleteFile={handleDeleteFile}
        onLoadProject={() => { }}
      />
    );
  }

  const currentPageData = activeFile.pages[activeFile.currentPage] || emptyPage();
  const pdfImages = pdfPageImages.get(activeFile.id) || [];
  const currentPdfImage = pdfImages[activeFile.currentPage] || null;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 flex items-center px-3 py-1.5 gap-3 shrink-0">
        <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Back to documents">
          <ArrowLeft size={18} />
        </button>
        {fileNameEdit ? (
          <input
            autoFocus
            value={activeFile.name}
            onChange={e => updateFile(activeFile.id, { name: e.target.value })}
            onBlur={() => setFileNameEdit(false)}
            onKeyDown={e => e.key === 'Enter' && setFileNameEdit(false)}
            className="text-sm font-medium border border-blue-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-200"
          />
        ) : (
          <button onClick={() => setFileNameEdit(true)} className="text-sm font-medium text-gray-700 hover:text-blue-600 truncate max-w-xs">
            {activeFile.name}
          </button>
        )}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0
          ${activeFile.type === 'pdf' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          {activeFile.type.toUpperCase()}
        </span>
        <div className="flex-1" />
        {statusMsg && (
          <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full animate-fade-in">{statusMsg}</span>
        )}
      </div>

      {/* Toolbar */}
      <div className="shrink-0 relative z-30">
        <Toolbar
          activeTool={activeTool} setActiveTool={setActiveTool}
          penColor={penColor} setPenColor={setPenColor}
          penWidth={penWidth} setPenWidth={setPenWidth}
          penStyle={penStyle} setPenStyle={setPenStyle}
          penOpacity={penOpacity} setPenOpacity={setPenOpacity}
          eraserMode={eraserMode} setEraserMode={setEraserMode}
          eraserWidth={eraserWidth} setEraserWidth={setEraserWidth}
          onCopy={() => canvasRef.current?.copySelection()}
          onPaste={() => canvasRef.current?.pasteSelection()}
          onDelete={() => canvasRef.current?.deleteSelection()}
          onUndo={handleUndo}
          onRedo={handleRedo}
          highlighterColor={highlighterColor} setHighlighterColor={setHighlighterColor}
          highlighterWidth={highlighterWidth} setHighlighterWidth={setHighlighterWidth}
          onSave={handleSave}
          onDownload={handleDownload}
          onImageInsert={handleImageInsert}
          zoom={zoom} setZoom={setZoom}
          currentPage={activeFile.currentPage}
          totalPages={activeFile.totalPages}
          onPageChange={handlePageChange}
          onAddPage={handleAddPage}
          savedPens={savedPens}
          onSavePen={handleSavePen}
          onLoadPen={handleLoadPen}
          onDeletePen={handleDeletePen}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
        />
      </div>

      {/* Canvas area — scrollable for PDF multi-page */}
      <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-200 to-gray-300">
        <div className="flex flex-col items-center py-6 gap-6">
          {activeFile.type === 'pdf' && pdfImages.length > 1 ? (
            pdfImages.map((_, pageIdx) => {
              const pgData = activeFile.pages[pageIdx] || emptyPage();
              const isActivePage = activeFile.currentPage === pageIdx;
              return (
                <div
                  key={pageIdx}
                  className={`relative shadow-2xl rounded-lg overflow-hidden border-2 transition-all ${isActivePage ? 'border-blue-400' : 'border-gray-300'}`}
                  onClick={() => handlePageChange(pageIdx)}
                >
                  <DrawingCanvas
                    ref={isActivePage ? canvasRef : undefined}
                    pageData={pgData}
                    onPageDataChange={isActivePage ? handlePageDataChange : () => {}}
                    activeTool={isActivePage ? (activeTool === 'pdfselect' ? 'pan' : activeTool) : 'pan'}
                    onToolChange={setActiveTool}
                    penColor={penColor}
                    penWidth={penWidth}
                    penStyle={penStyle}
                    penOpacity={penOpacity}
                    highlighterColor={highlighterColor}
                    highlighterWidth={highlighterWidth}
                    eraserMode={eraserMode}
                    eraserWidth={eraserWidth}
                    pdfPageImage={pdfImages[pageIdx] || null}
                    canvasWidth={CANVAS_W}
                    canvasHeight={CANVAS_H}
                    zoom={zoom}
                  />
                  {activeFile.pdfDataUrl && (
                    <PdfTextLayer
                      pdfDataUrl={activeFile.pdfDataUrl}
                      pageIndex={pageIdx}
                      canvasWidth={CANVAS_W}
                      canvasHeight={CANVAS_H}
                      zoom={zoom}
                      active={isActivePage && activeTool === 'pdfselect'}
                    />
                  )}
                  <div className="absolute bottom-1 right-2 text-[10px] text-gray-400 bg-white/70 px-1.5 py-0.5 rounded">
                    Page {pageIdx + 1}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-gray-300">
              <DrawingCanvas
                ref={canvasRef}
                pageData={currentPageData}
                onPageDataChange={handlePageDataChange}
                activeTool={activeTool === 'pdfselect' ? 'pan' : activeTool}
                onToolChange={setActiveTool}
                penColor={penColor}
                penWidth={penWidth}
                penStyle={penStyle}
                penOpacity={penOpacity}
                highlighterColor={highlighterColor}
                highlighterWidth={highlighterWidth}
                eraserMode={eraserMode}
                eraserWidth={eraserWidth}
                pdfPageImage={currentPdfImage}
                canvasWidth={CANVAS_W}
                canvasHeight={CANVAS_H}
                zoom={zoom}
              />
              {activeFile.pdfDataUrl && (
                <PdfTextLayer
                  pdfDataUrl={activeFile.pdfDataUrl}
                  pageIndex={activeFile.currentPage}
                  canvasWidth={CANVAS_W}
                  canvasHeight={CANVAS_H}
                  zoom={zoom}
                  active={activeTool === 'pdfselect'}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
    </div>
  );
}

export default App;
