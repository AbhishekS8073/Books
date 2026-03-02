import React, { useState } from 'react';
import { ToolType, EraserMode, PenStyle, SavedPen } from '../types';
import {
  Pen, Highlighter, Eraser, MousePointer, Lasso, Type, Image, 
  ChevronDown, Minus, Plus, Trash2, Copy, Clipboard, Download,
  Save, Undo, Redo, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  PenTool, Paintbrush, Circle, TextSelect
} from 'lucide-react';

interface Props {
  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  penColor: string;
  setPenColor: (c: string) => void;
  penWidth: number;
  setPenWidth: (w: number) => void;
  penStyle: PenStyle;
  setPenStyle: (s: PenStyle) => void;
  penOpacity: number;
  setPenOpacity: (o: number) => void;
  highlighterColor: string;
  setHighlighterColor: (c: string) => void;
  highlighterWidth: number;
  setHighlighterWidth: (w: number) => void;
  eraserMode: EraserMode;
  setEraserMode: (m: EraserMode) => void;
  eraserWidth: number;
  setEraserWidth: (w: number) => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onDownload: () => void;
  onImageInsert: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onAddPage: () => void;
  savedPens: SavedPen[];
  onSavePen: () => void;
  onLoadPen: (p: SavedPen) => void;
  onDeletePen: (id: string) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#92400e', '#065f46',
  '#1e3a5f', '#581c87', '#9f1239', '#78716c'
];

const Toolbar: React.FC<Props> = (props) => {
  const [showPenPanel, setShowPenPanel] = useState(false);
  const [showHighlighterPanel, setShowHighlighterPanel] = useState(false);
  const [showEraserPanel, setShowEraserPanel] = useState(false);
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [showSavedPens, setShowSavedPens] = useState(false);
  const [showTextOptions, setShowTextOptions] = useState(false);

  const closeAll = () => {
    setShowPenPanel(false);
    setShowHighlighterPanel(false);
    setShowEraserPanel(false);
    setShowColorPanel(false);
    setShowSavedPens(false);
    setShowTextOptions(false);
  };

  const ToolBtn = ({tool, icon, label, hasDropdown, onDropdown}: {tool: ToolType, icon: React.ReactNode, label: string, hasDropdown?: boolean, onDropdown?: ()=>void}) => (
    <div className="relative flex items-center">
      <button
        onClick={() => { props.setActiveTool(tool); closeAll(); }}
        className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all text-xs gap-0.5
          ${props.activeTool === tool ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
        title={label}
      >
        {icon}
        <span className="text-[10px]">{label}</span>
      </button>
      {hasDropdown && (
        <button
          onClick={(e) => { e.stopPropagation(); onDropdown?.(); }}
          className="ml-[-4px] p-0.5 rounded hover:bg-gray-200"
        >
          <ChevronDown size={10} />
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      {/* Main toolbar */}
      <div className="flex items-center px-3 py-1.5 gap-1 overflow-x-auto">
        {/* File actions */}
        <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
          <button onClick={props.onSave} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Save">
            <Save size={18} />
          </button>
          <button onClick={props.onDownload} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Download">
            <Download size={18} />
          </button>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button onClick={props.onUndo} disabled={!props.canUndo}
            className={`p-1.5 rounded-lg ${props.canUndo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300'}`} title="Undo">
            <Undo size={18} />
          </button>
          <button onClick={props.onRedo} disabled={!props.canRedo}
            className={`p-1.5 rounded-lg ${props.canRedo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300'}`} title="Redo">
            <Redo size={18} />
          </button>
        </div>

        {/* Drawing tools */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <ToolBtn tool="pen" icon={<Pen size={18} />} label="Pen" hasDropdown
            onDropdown={() => { closeAll(); setShowPenPanel(!showPenPanel); }} />
          <ToolBtn tool="highlighter" icon={<Highlighter size={18} />} label="Highlight" hasDropdown
            onDropdown={() => { closeAll(); setShowHighlighterPanel(!showHighlighterPanel); }} />
          <ToolBtn tool="eraser" icon={<Eraser size={18} />} label="Eraser" hasDropdown
            onDropdown={() => { closeAll(); setShowEraserPanel(!showEraserPanel); }} />
        </div>

        {/* Selection tools */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <ToolBtn tool="select" icon={<MousePointer size={18} />} label="Select" />
          <ToolBtn tool="lasso" icon={<Lasso size={18} />} label="Lasso" />
        </div>

        {/* Content tools */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <ToolBtn tool="text" icon={<Type size={18} />} label="Text" />
          <ToolBtn tool="pdfselect" icon={<TextSelect size={18} />} label="PDF Text" />
          <div className="relative">
            <button
              onClick={props.onImageInsert}
              className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all text-xs gap-0.5 text-gray-600 hover:bg-gray-100`}
              title="Insert Image"
            >
              <Image size={18} />
              <span className="text-[10px]">Image</span>
            </button>
          </div>
        </div>

        {/* Color */}
        <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
          <button
            onClick={() => { closeAll(); setShowColorPanel(!showColorPanel); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100"
            title="Color"
          >
            <div className="w-5 h-5 rounded-full border-2 border-gray-300" style={{backgroundColor: props.penColor}} />
            <ChevronDown size={10} />
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Size:</span>
            <button onClick={() => props.setPenWidth(Math.max(1, props.penWidth - 1))} className="p-0.5 rounded hover:bg-gray-200">
              <Minus size={12} />
            </button>
            <span className="text-xs w-6 text-center">{props.penWidth}</span>
            <button onClick={() => props.setPenWidth(Math.min(50, props.penWidth + 1))} className="p-0.5 rounded hover:bg-gray-200">
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Clipboard */}
        <div className="flex items-center gap-0.5 border-r border-gray-200 pr-2 mr-1">
          <button onClick={props.onCopy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Copy (Ctrl+C)">
            <Copy size={16} />
          </button>
          <button onClick={props.onPaste} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="Paste (Ctrl+V)">
            <Clipboard size={16} />
          </button>
          <button onClick={props.onDelete} className="p-1.5 rounded-lg hover:bg-gray-100 text-red-500" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>

        {/* Saved Pens */}
        <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
          <button onClick={() => { closeAll(); setShowSavedPens(!showSavedPens); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 text-xs text-gray-600">
            <PenTool size={14} /> Saved Pens <ChevronDown size={10} />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1">
          <button onClick={() => props.setZoom(Math.max(0.25, props.zoom - 0.25))} className="p-1 rounded hover:bg-gray-200">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs w-10 text-center">{Math.round(props.zoom * 100)}%</span>
          <button onClick={() => props.setZoom(Math.min(3, props.zoom + 0.25))} className="p-1 rounded hover:bg-gray-200">
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => props.onPageChange(props.currentPage - 1)} disabled={props.currentPage <= 0}
            className={`p-1 rounded ${props.currentPage > 0 ? 'hover:bg-gray-200' : 'text-gray-300'}`}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs">{props.currentPage + 1}/{props.totalPages}</span>
          <button onClick={() => props.onPageChange(props.currentPage + 1)} disabled={props.currentPage >= props.totalPages - 1}
            className={`p-1 rounded ${props.currentPage < props.totalPages - 1 ? 'hover:bg-gray-200' : 'text-gray-300'}`}>
            <ChevronRight size={16} />
          </button>
          <button onClick={props.onAddPage} className="text-[10px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
            + Page
          </button>
        </div>
      </div>

      {/* Pen Panel */}
      {showPenPanel && (
        <div className="absolute top-14 left-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-72">
          <h3 className="font-semibold text-sm mb-3">Pen Style</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              {id: 'pen', label: 'Standard', icon: <Pen size={16} />},
              {id: 'brush', label: 'Brush', icon: <Paintbrush size={16} />},
              {id: 'fountain', label: 'Fountain', icon: <PenTool size={16} />},
              {id: 'ballpen', label: 'Ball Pen', icon: <Circle size={16} />},
            ] as const).map(ps => (
              <button key={ps.id} onClick={() => props.setPenStyle(ps.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                  ${props.penStyle === ps.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                {ps.icon} {ps.label}
              </button>
            ))}
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Thickness: {props.penWidth}px</label>
            <input type="range" min="1" max="50" value={props.penWidth}
              onChange={e => props.setPenWidth(Number(e.target.value))}
              className="w-full accent-blue-500" />
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Opacity: {Math.round(props.penOpacity * 100)}%</label>
            <input type="range" min="10" max="100" value={props.penOpacity * 100}
              onChange={e => props.setPenOpacity(Number(e.target.value) / 100)}
              className="w-full accent-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Pressure Sensitivity</label>
            <span className="text-[10px] text-gray-400">(stylus)</span>
          </div>
          <button onClick={props.onSavePen} className="mt-3 w-full py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Save Current Pen
          </button>
        </div>
      )}

      {/* Highlighter Panel */}
      {showHighlighterPanel && (
        <div className="absolute top-14 left-36 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-72">
          <h3 className="font-semibold text-sm mb-3">Highlighter</h3>
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Colour</label>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {['#facc15','#86efac','#67e8f9','#f9a8d4','#fca5a5','#a5b4fc','#fb923c','#ffffff'].map(c => (
                <button key={c} onClick={() => props.setHighlighterColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${props.highlighterColor === c ? 'border-blue-500 scale-110' : 'border-gray-300'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Custom:</label>
              <input type="color" value={props.highlighterColor} onChange={e => props.setHighlighterColor(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer" />
              <span className="text-xs text-gray-400">{props.highlighterColor}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Width: {props.highlighterWidth}px</label>
            <input type="range" min="8" max="60" value={props.highlighterWidth}
              onChange={e => props.setHighlighterWidth(Number(e.target.value))}
              className="w-full accent-yellow-400" />
            <div className="mt-2 flex items-center justify-center">
              <div style={{ width: '80%', height: props.highlighterWidth / 2, backgroundColor: props.highlighterColor, opacity: 0.6, borderRadius: 99 }} />
            </div>
          </div>
        </div>
      )}

      {/* Eraser Panel */}
      {showEraserPanel && (
        <div className="absolute top-14 left-40 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-64">
          <h3 className="font-semibold text-sm mb-3">Eraser Mode</h3>
          <div className="space-y-2 mb-3">
            {([
              {id: 'continuous', label: 'Continuous Eraser', desc: 'Erase as you draw'},
              {id: 'stroke', label: 'Stroke Eraser', desc: 'Erase whole strokes'},
              {id: 'partial', label: 'Partial Eraser', desc: 'Split strokes at erase point'},
            ] as const).map(em => (
              <button key={em.id} onClick={() => props.setEraserMode(em.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm
                  ${props.eraserMode === em.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="font-medium">{em.label}</div>
                <div className="text-xs text-gray-400">{em.desc}</div>
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Eraser Size: {props.eraserWidth}px</label>
            <input type="range" min="5" max="100" value={props.eraserWidth}
              onChange={e => props.setEraserWidth(Number(e.target.value))}
              className="w-full accent-blue-500" />
          </div>
        </div>
      )}

      {/* Color Panel */}
      {showColorPanel && (
        <div className="absolute top-14 left-[50%] -translate-x-1/2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-64">
          <h3 className="font-semibold text-sm mb-3">Colors</h3>
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {COLORS.map(c => (
              <button key={c} onClick={() => props.setPenColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                  ${props.penColor === c ? 'border-blue-500 scale-110' : 'border-gray-200'}`}
                style={{backgroundColor: c}} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Custom:</label>
            <input type="color" value={props.penColor} onChange={e => props.setPenColor(e.target.value)}
              className="w-8 h-8 rounded border-0 cursor-pointer" />
            <span className="text-xs text-gray-400">{props.penColor}</span>
          </div>
        </div>
      )}

      {/* Saved Pens Panel */}
      {showSavedPens && (
        <div className="absolute top-14 right-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-72 max-h-80 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-3">Saved Pens</h3>
          {props.savedPens.length === 0 ? (
            <p className="text-xs text-gray-400">No saved pens yet. Configure a pen and save it.</p>
          ) : (
            <div className="space-y-2">
              {props.savedPens.map(sp => (
                <div key={sp.id} className="flex items-center gap-2 p-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                  <div className="w-4 h-4 rounded-full" style={{backgroundColor: sp.color}} />
                  <div className="flex-1">
                    <div className="text-xs font-medium">{sp.name}</div>
                    <div className="text-[10px] text-gray-400">{sp.tool} • {sp.width}px • {Math.round(sp.opacity*100)}%</div>
                  </div>
                  <button onClick={() => props.onLoadPen(sp)} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Use</button>
                  <button onClick={() => props.onDeletePen(sp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close panels */}
      {(showPenPanel || showHighlighterPanel || showEraserPanel || showColorPanel || showSavedPens || showTextOptions) && (
        <div className="fixed inset-0 z-40" onClick={closeAll} />
      )}
    </div>
  );
};

export default Toolbar;
