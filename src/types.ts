export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  tool: 'pen' | 'highlighter' | 'brush' | 'fountain' | 'ballpen';
  compositeOp: GlobalCompositeOperation;
}

export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  editing: boolean;
}

export interface ImageObj {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  behindContent: boolean;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface StickerNote {
  id: string;
  x: number;          // position on canvas (anchor point)
  y: number;
  text: string;
  color: string;      // background colour of the sticky
  linkedRegion?: { x: number; y: number; w: number; h: number; linkedText?: string }; // optional text-link region
  createdAt: number;
  collapsed: boolean;
}

export interface PageData {
  strokes: Stroke[];
  textBoxes: TextBox[];
  images: ImageObj[];
  stickerNotes: StickerNote[];
}

export interface ProjectFile {
  id: string;
  name: string;
  type: 'note' | 'pdf';
  createdAt: number;
  updatedAt: number;
  pages: PageData[];
  pdfDataUrl?: string;
  currentPage: number;
  totalPages: number;
  thumbnail?: string;
}

export interface SavedPen {
  id: string;
  name: string;
  color: string;
  width: number;
  tool: 'pen' | 'highlighter' | 'brush' | 'fountain' | 'ballpen';
  opacity: number;
}

export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'select' | 'lasso' | 'text' | 'image' | 'pan' | 'pdfselect' | 'sticker';
export type EraserMode = 'continuous' | 'stroke' | 'partial';
export type PenStyle = 'pen' | 'brush' | 'fountain' | 'ballpen';
