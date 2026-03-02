import React, { useState, useRef } from 'react';
import { StickerNote } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  StickyNote, Plus, Trash2, ChevronRight, ChevronDown,
  Link2, Edit3, Check, BookOpen, LayoutList
} from 'lucide-react';

interface Props {
  notes: StickerNote[];
  allNotes: { pageIndex: number; note: StickerNote }[];
  currentPageIndex: number;
  totalPages: number;
  onChange: (notes: StickerNote[]) => void;
  onHighlightRegion?: (region: { x: number; y: number; w: number; h: number } | null) => void;
  onAddStickerToCanvas?: (note: StickerNote) => void;
  onJumpToPage?: (page: number) => void;
}

type Tab = 'page' | 'all';

const COLORS = [
  '#fef08a', '#bbf7d0', '#bae6fd', '#fecaca',
  '#e9d5ff', '#fed7aa', '#f0fdf4', '#fdf4ff',
];

/* ── Main Panel ────────────────────────────────────────────────────────────── */
const StickerNotesPanel: React.FC<Props> = ({
  notes, allNotes, currentPageIndex, onChange,
  onHighlightRegion, onAddStickerToCanvas, onJumpToPage
}) => {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('page');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const addNote = () => {
    const note: StickerNote = {
      id: uuidv4(), x: 60, y: 60, text: '',
      color: COLORS[notes.length % COLORS.length],
      createdAt: Date.now(), collapsed: false,
    };
    onChange([...notes, note]);
    setEditingId(note.id);
    setDraftText('');
    setTab('page');
    setTimeout(() => textareaRef.current?.focus(), 60);
  };

  const saveEdit = (id: string) => {
    onChange(notes.map(n => n.id === id ? { ...n, text: draftText } : n));
    setEditingId(null);
  };

  const startEdit = (note: StickerNote) => {
    setEditingId(note.id);
    setDraftText(note.text);
    setTimeout(() => textareaRef.current?.focus(), 60);
  };

  return (
    <div
      className="flex flex-col bg-white border-l border-gray-200 shadow-xl transition-all duration-200 shrink-0"
      style={{ width: open ? 278 : 40, minHeight: '100%' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 py-2.5 border-b border-gray-100 cursor-pointer select-none hover:bg-gray-50 shrink-0"
        onClick={() => setOpen(o => !o)}
      >
        <StickyNote size={16} className="text-yellow-500 shrink-0" />
        {open && <span className="text-sm font-semibold text-gray-700 flex-1">Sticker Notes</span>}
        <ChevronRight
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setTab('page')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors ${
                tab === 'page'
                  ? 'text-yellow-600 border-b-2 border-yellow-400 bg-yellow-50'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={11} />
              This Page
              {notes.length > 0 && (
                <span className="ml-0.5 bg-yellow-400 text-yellow-900 text-[9px] font-bold px-1 rounded-full">
                  {notes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('all')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors ${
                tab === 'all'
                  ? 'text-blue-600 border-b-2 border-blue-400 bg-blue-50'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <LayoutList size={11} />
              All Notes
              {allNotes.length > 0 && (
                <span className="ml-0.5 bg-blue-400 text-white text-[9px] font-bold px-1 rounded-full">
                  {allNotes.length}
                </span>
              )}
            </button>
          </div>

          {/* Add button */}
          {tab === 'page' && (
            <div className="px-2 py-2 border-b border-gray-100 shrink-0">
              <button
                onClick={addNote}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-700 text-xs font-medium transition-colors"
              >
                <Plus size={13} /> New Sticker Note
              </button>
            </div>
          )}

          {/* THIS PAGE */}
          {tab === 'page' && (
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {notes.length === 0 ? (
                <div className="text-center text-xs text-gray-400 pt-8 px-2">
                  <StickyNote size={28} className="mx-auto mb-2 text-gray-300" />
                  No sticker notes on this page.<br />
                  <span className="text-[10px] leading-relaxed">
                    Select PDF text and click "Add Sticker", or press "New Sticker Note".
                  </span>
                </div>
              ) : (
                notes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    editingId={editingId}
                    draftText={draftText}
                    textareaRef={textareaRef}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDraftChange={setDraftText}
                    onDelete={id => { onChange(notes.filter(n => n.id !== id)); if (editingId === id) setEditingId(null); }}
                    onToggleCollapse={id => onChange(notes.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n))}
                    onSetColor={(id, c) => onChange(notes.map(n => n.id === id ? { ...n, color: c } : n))}
                    onRemoveLink={id => { onChange(notes.map(n => n.id === id ? { ...n, linkedRegion: undefined } : n)); onHighlightRegion?.(null); }}
                    onHighlightRegion={onHighlightRegion}
                    onAddToCanvas={onAddStickerToCanvas}
                    onLinkSave={(id, region) => onChange(notes.map(n => n.id === id ? { ...n, linkedRegion: region } : n))}
                  />
                ))
              )}
            </div>
          )}

          {/* ALL NOTES */}
          {tab === 'all' && (
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {allNotes.length === 0 ? (
                <div className="text-center text-xs text-gray-400 pt-8">
                  <LayoutList size={28} className="mx-auto mb-2 text-gray-300" />
                  No sticker notes in this document yet.
                </div>
              ) : (
                (() => {
                  const byPage = new Map<number, StickerNote[]>();
                  allNotes.forEach(({ pageIndex, note }) => {
                    if (!byPage.has(pageIndex)) byPage.set(pageIndex, []);
                    byPage.get(pageIndex)!.push(note);
                  });
                  return Array.from(byPage.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([pageIdx, pageNotes]) => (
                      <div key={pageIdx} className="mb-4">
                        <div className="flex items-center justify-between mb-1.5 sticky top-0 bg-white py-0.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                            Page {pageIdx + 1}
                            {pageIdx === currentPageIndex && (
                              <span className="ml-1 text-blue-500 normal-case font-normal">(current)</span>
                            )}
                          </span>
                          {pageIdx !== currentPageIndex && onJumpToPage && (
                            <button
                              onClick={() => onJumpToPage(pageIdx)}
                              className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                            >
                              Go to page →
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {pageNotes.map(note => (
                            <AllNoteRow
                              key={note.id}
                              note={note}
                              onHighlightRegion={pageIdx === currentPageIndex ? onHighlightRegion : undefined}
                              onJumpToPage={() => onJumpToPage?.(pageIdx)}
                              isSamePage={pageIdx === currentPageIndex}
                            />
                          ))}
                        </div>
                      </div>
                    ));
                })()
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ── NoteCard ──────────────────────────────────────────────────────────────── */
interface NoteCardProps {
  note: StickerNote;
  editingId: string | null;
  draftText: string;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  onStartEdit: (n: StickerNote) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDraftChange: (v: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onSetColor: (id: string, c: string) => void;
  onRemoveLink: (id: string) => void;
  onHighlightRegion?: (r: { x: number; y: number; w: number; h: number } | null) => void;
  onAddToCanvas?: (n: StickerNote) => void;
  onLinkSave: (id: string, region: { x: number; y: number; w: number; h: number }) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  note, editingId, draftText, textareaRef,
  onStartEdit, onSaveEdit, onCancelEdit, onDraftChange,
  onDelete, onToggleCollapse, onSetColor, onRemoveLink,
  onHighlightRegion, onAddToCanvas, onLinkSave,
}) => {
  const isEditing = editingId === note.id;
  const linkedText = note.linkedRegion?.linkedText;

  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{ borderColor: note.color === '#fef08a' ? '#fde047' : '#e5e7eb', backgroundColor: note.color }}
      onMouseEnter={() => note.linkedRegion && onHighlightRegion?.(note.linkedRegion)}
      onMouseLeave={() => onHighlightRegion?.(null)}
    >
      {/* Row: swatches + actions */}
      <div className="flex items-center gap-1 px-2 pt-1.5 pb-1">
        <div className="flex gap-0.5">
          {COLORS.slice(0, 5).map(c => (
            <button key={c} onClick={() => onSetColor(note.id, c)}
              className={`w-3 h-3 rounded-full border transition-transform hover:scale-125 ${note.color === c ? 'border-gray-600 scale-125' : 'border-gray-300'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex-1" />
        {note.linkedRegion && (
          <button onClick={() => onRemoveLink(note.id)} className="p-0.5 rounded hover:bg-black/10 text-blue-600" title="Linked — click to unlink">
            <Link2 size={11} />
          </button>
        )}
        <button onClick={() => onAddToCanvas?.(note)} className="p-0.5 rounded hover:bg-black/10 text-gray-500 text-[10px]" title="Place on canvas">↗</button>
        {!isEditing && (
          <button onClick={() => onStartEdit(note)} className="p-0.5 rounded hover:bg-black/10 text-gray-500"><Edit3 size={11} /></button>
        )}
        <button onClick={() => onToggleCollapse(note.id)} className="p-0.5 rounded hover:bg-black/10 text-gray-500">
          {note.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </button>
        <button onClick={() => onDelete(note.id)} className="p-0.5 rounded hover:bg-red-200 text-red-400"><Trash2 size={11} /></button>
      </div>

      {!note.collapsed && (
        <div className="px-2 pb-2">
          {/* Linked text excerpt */}
          {linkedText && (
            <div className="mb-1.5 flex items-start gap-1 text-[10px] bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2 py-1">
              <Link2 size={9} className="mt-0.5 shrink-0" />
              <span className="italic leading-tight line-clamp-2">"{linkedText}"</span>
            </div>
          )}

          {isEditing ? (
            <div>
              <textarea
                ref={textareaRef}
                value={draftText}
                onChange={e => onDraftChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') onCancelEdit();
                  if (e.key === 'Enter' && e.ctrlKey) onSaveEdit(note.id);
                  e.stopPropagation();
                }}
                placeholder="Write your note…"
                className="w-full text-xs rounded-lg p-1.5 border border-gray-300 bg-white/80 outline-none resize-none leading-relaxed"
                rows={4}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              />
              <div className="flex gap-1 mt-1">
                <button onClick={() => onSaveEdit(note.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-green-500 text-white text-xs hover:bg-green-600">
                  <Check size={11} /> Save
                </button>
                <button onClick={onCancelEdit}
                  className="px-2 py-1 rounded-lg bg-gray-200 text-gray-600 text-xs hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {note.text ? (
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed cursor-text" onClick={() => onStartEdit(note)}>
                  {note.text}
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic cursor-text" onClick={() => onStartEdit(note)}>Click to add text…</p>
              )}
              {!note.linkedRegion && (
                <InlineLinkButton onLink={r => onLinkSave(note.id, r)} />
              )}
              <div className="mt-1 text-[9px] text-gray-400">
                {new Date(note.createdAt).toLocaleDateString()}{' '}
                {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── InlineLinkButton ──────────────────────────────────────────────────────── */
const InlineLinkButton: React.FC<{
  onLink: (r: { x: number; y: number; w: number; h: number }) => void;
}> = ({ onLink }) => {
  const [open, setOpen] = useState(false);
  const [x, setX] = useState('0');
  const [y, setY] = useState('0');
  const [w, setW] = useState('200');
  const [h, setH] = useState('50');

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 underline underline-offset-2">
      <Link2 size={9} /> Link to region manually
    </button>
  );

  return (
    <div className="mt-1.5 bg-white/80 rounded-lg border border-gray-200 p-1.5 text-[10px]">
      <p className="text-gray-500 mb-1">Region (x, y, w, h):</p>
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        {([['x', x, setX], ['y', y, setY], ['w', w, setW], ['h', h, setH]] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, val, setter]) => (
          <label key={label} className="flex items-center gap-1">
            <span className="text-gray-400 w-3">{label}:</span>
            <input type="number" value={val} onChange={e => setter(e.target.value)}
              className="w-full border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:border-blue-400"
              onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} />
          </label>
        ))}
      </div>
      <div className="flex gap-1">
        <button onClick={() => { onLink({ x: +x, y: +y, w: +w, h: +h }); setOpen(false); }}
          className="flex-1 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600">Link</button>
        <button onClick={() => setOpen(false)} className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded">✕</button>
      </div>
    </div>
  );
};

/* ── AllNoteRow ────────────────────────────────────────────────────────────── */
const AllNoteRow: React.FC<{
  note: StickerNote;
  onHighlightRegion?: (r: { x: number; y: number; w: number; h: number } | null) => void;
  onJumpToPage: () => void;
  isSamePage: boolean;
}> = ({ note, onHighlightRegion, onJumpToPage, isSamePage }) => {
  const linkedText = note.linkedRegion?.linkedText;
  return (
    <div
      className="rounded-lg border px-2 py-1.5 cursor-pointer hover:shadow-md transition-shadow"
      style={{ backgroundColor: note.color, borderColor: '#e5e7eb' }}
      onMouseEnter={() => note.linkedRegion && isSamePage && onHighlightRegion?.(note.linkedRegion)}
      onMouseLeave={() => onHighlightRegion?.(null)}
      onClick={!isSamePage ? onJumpToPage : undefined}
    >
      <div className="flex items-start gap-1.5">
        <StickyNote size={11} className="text-gray-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {linkedText && (
            <p className="text-[9px] text-blue-600 italic mb-0.5 line-clamp-1">"{linkedText}"</p>
          )}
          <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">
            {note.text || <span className="text-gray-400 italic">Empty note</span>}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {note.linkedRegion && <Link2 size={8} className="text-blue-400" />}
            <span className="text-[9px] text-gray-400">{new Date(note.createdAt).toLocaleDateString()}</span>
            {!isSamePage && <span className="text-[9px] text-blue-500 underline ml-auto">→ go</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickerNotesPanel;
