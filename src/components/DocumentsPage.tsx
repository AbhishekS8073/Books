import React, { useRef } from 'react';
import { ProjectFile } from '../types';
import { Plus, FileText, Upload, Trash2, Clock, FolderOpen } from 'lucide-react';

interface Props {
  files: ProjectFile[];
  onOpenFile: (id: string) => void;
  onNewNote: () => void;
  onUploadPdf: (file: File) => void;
  onDeleteFile: (id: string) => void;
  onLoadProject: () => void;
}

const DocumentsPage: React.FC<Props> = ({ files, onOpenFile, onNewNote, onUploadPdf, onDeleteFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPdf(file);
      e.target.value = '';
    }
  };

  const handleProjectLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data && data.id) {
            // dispatch custom event
            window.dispatchEvent(new CustomEvent('loadProject', { detail: data }));
          }
        } catch (err) {
          alert('Invalid project file');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">Drawboard Notes</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => projectInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
              <FolderOpen size={16} /> Open Project
            </button>
            <input ref={projectInputRef} type="file" accept=".dbnotes" onChange={handleProjectLoad} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
              <Upload size={16} /> Upload PDF
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            <button onClick={onNewNote}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-200">
              <Plus size={16} /> New Note
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mb-6">
              <FileText size={40} className="text-gray-300" />
            </div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No documents yet</h2>
            <p className="text-gray-400 mb-6 text-center max-w-md">Create a new note or upload a PDF to get started with annotation</p>
            <div className="flex gap-3">
              <button onClick={onNewNote}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-200 transition-all">
                <Plus size={18} /> New Note
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium border border-gray-200 transition-all">
                <Upload size={18} /> Upload PDF
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Recent Documents ({files.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.sort((a, b) => b.updatedAt - a.updatedAt).map(f => (
                <div key={f.id}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
                  onClick={() => onOpenFile(f.id)}>
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                    {f.thumbnail ? (
                      <img src={f.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={48} className="text-gray-200" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onDeleteFile(f.id); }}
                        className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                        ${f.type === 'pdf' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {f.type === 'pdf' ? 'PDF' : 'NOTE'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-gray-800 truncate">{f.name}</h3>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                      <Clock size={10} />
                      {formatDate(f.updatedAt)}
                      <span className="ml-auto">{f.totalPages} page{f.totalPages > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;
