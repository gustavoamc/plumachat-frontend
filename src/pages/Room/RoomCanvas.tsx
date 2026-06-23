import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { getSocket } from '../../utils/socket';
import api from '../../utils/api';
import { Button } from '../../components/ui/Button';
import styles from './RoomCanvas.module.css';

// --- Shape model (mirrors shared/types/drawing.ts) -------------------------
// Every shape shares id + drag offset (x,y) + optional rotation. The `type`
// discriminator selects the type-specific fields. A shape arriving without a
// `type` is a legacy freehand stroke and is normalized to 'line'.
interface ShapeBase {
  id: string;
  x: number;
  y: number;
  rotation?: number;
}
interface LineShape extends ShapeBase {
  type: 'line';
  points: number[];
  stroke: string;
  strokeWidth: number;
}
interface RectShape extends ShapeBase {
  type: 'rect';
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}
interface EllipseShape extends ShapeBase {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}
interface ArrowShape extends ShapeBase {
  type: 'arrow';
  points: number[];
  stroke: string;
  strokeWidth: number;
  arrow: boolean;
}
interface TextShape extends ShapeBase {
  type: 'text';
  text: string;
  fontSize: number;
  fill: string;
  width?: number;
}
interface ImageShape extends ShapeBase {
  type: 'image';
  src: string;
  width: number;
  height: number;
}
type DrawShape =
  | LineShape | RectShape | EllipseShape | ArrowShape | TextShape | ImageShape;

// A persisted/remote shape without a `type` is a legacy freehand stroke.
const normalize = (s: any): DrawShape =>
  s && typeof s.type === 'string' ? s : ({ ...s, type: 'line' } as DrawShape);

// Backend base URL; image `src` values are paths we resolve against it.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Shapes that support resize/rotate via the Transformer.
const RESIZABLE = new Set<DrawShape['type']>(['rect', 'ellipse', 'text', 'image']);

// Default board size until the room's setting arrives. The actual size is set by
// the owner and shared by every client; smaller screens scroll the board.
const DEFAULT_W = 1280;
const DEFAULT_H = 720;

// Preset sizes the owner can pick from.
const CANVAS_SIZES = [
  { w: 800, h: 600 },
  { w: 1280, h: 720 },
  { w: 1600, h: 900 },
  { w: 1920, h: 1080 },
  { w: 1200, h: 1200 },
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // keep in sync with the backend limit
const IMPORT_MAX_DIM = 480; // imported images are scaled to fit within this box

// Throttle live drag emissions: at most one socket message per this interval to
// avoid flooding the network during a drag (the final position is sent on drop).
const MOVE_THROTTLE_MS = 30;

// Classic 2-row palette (saturated row on top, light/pastel row below).
const COLORS = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27',
  '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e',
  '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
];

type Tool = 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'image' | 'move' | 'eraser' | 'pan';

// A reversible board action by this client, for local undo/redo. Each op records
// what changed; undo/redo replay it via the normal socket events so every other
// client stays in sync.
type Op =
  | { type: 'add'; shape: DrawShape }
  | { type: 'remove'; shape: DrawShape }
  | { type: 'move'; id: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'update'; before: DrawShape; after: DrawShape }
  | { type: 'clear'; shapes: DrawShape[] };

interface RoomCanvasProps {
  roomId: string;
  // When set, overrides the room's owner-only draw rule. Used by the draw_guess
  // game mode to lock drawing to the current drawer (true) / everyone else
  // (false). Leave undefined for normal rooms.
  canDrawOverride?: boolean;
}

// Loads an image URL into a Konva.Image node. One component per image so the
// load hook isn't called in a loop.
function URLImage({
  shape,
  draggable,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  registerRef,
}: {
  shape: ImageShape;
  draggable: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: () => void;
  registerRef: (node: Konva.Node | null) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    const onLoad = () => setImg(image);
    image.addEventListener('load', onLoad);
    image.src = API_BASE + shape.src;
    return () => image.removeEventListener('load', onLoad);
  }, [shape.src]);

  return (
    <KonvaImage
      ref={registerRef}
      image={img ?? undefined}
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      rotation={shape.rotation ?? 0}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
}

export function RoomCanvas({ roomId, canDrawOverride }: RoomCanvasProps) {
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [draft, setDraft] = useState<DrawShape | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [drawingOwnerOnly, setDrawingOwnerOnly] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_W);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_H);
  const [undoStack, setUndoStack] = useState<Op[]>([]);
  const [redoStack, setRedoStack] = useState<Op[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The text shape currently being edited via the overlay textarea.
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [textValue, setTextValue] = useState('');

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef(new Map<string, Konva.Node>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Mirrors `editing` so commit/cancel can run exactly once even when both a
  // pointer-down and the textarea's blur fire for the same interaction.
  const editingRef = useRef<{ id: string; isNew: boolean } | null>(null);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // The id of the shape this client is actively dragging, so remote moves for
  // the same shape are ignored locally (prevents "fighting" cursors).
  const draggingIdRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMoveEmitRef = useRef(0);

  const canDraw =
    canDrawOverride !== undefined ? canDrawOverride : !drawingOwnerOnly || isOwner;

  // --- Socket wiring: request current state and listen for remote updates ---
  useEffect(() => {
    const socket = getSocket();
    socket.emit('draw_request_state', roomId);

    const onState = (data: {
      shapes: any[];
      drawingOwnerOnly: boolean;
      canvasWidth: number;
      canvasHeight: number;
      isOwner: boolean;
    }) => {
      setShapes((data.shapes ?? []).map(normalize));
      setDrawingOwnerOnly(!!data.drawingOwnerOnly);
      setIsOwner(!!data.isOwner);
      if (data.canvasWidth) setCanvasWidth(data.canvasWidth);
      if (data.canvasHeight) setCanvasHeight(data.canvasHeight);
    };
    const onAdd = ({ shape }: { shape: any }) => {
      const s = normalize(shape);
      setShapes(prev => [...prev.filter(p => p.id !== s.id), s]);
    };
    const onUpdate = ({ shape }: { shape: any }) => {
      const s = normalize(shape);
      setShapes(prev => prev.map(p => (p.id === s.id ? s : p)));
    };
    const onMove = ({ id, x, y }: { id: string; x: number; y: number }) => {
      // Server is source of truth, but keep our local position if we're the one
      // dragging this shape (avoids the two cursors fighting).
      if (draggingIdRef.current === id) return;
      setShapes(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    };
    const onRemove = ({ id }: { id: string }) => {
      setShapes(prev => prev.filter(s => s.id !== id));
    };
    const onClear = () => setShapes([]);
    const onSettings = (data: { drawingOwnerOnly: boolean; canvasWidth?: number; canvasHeight?: number }) => {
      setDrawingOwnerOnly(!!data.drawingOwnerOnly);
      if (data.canvasWidth) setCanvasWidth(data.canvasWidth);
      if (data.canvasHeight) setCanvasHeight(data.canvasHeight);
    };

    socket.on('draw_state', onState);
    socket.on('draw_add', onAdd);
    socket.on('draw_update', onUpdate);
    socket.on('draw_move', onMove);
    socket.on('draw_remove', onRemove);
    socket.on('draw_clear', onClear);
    socket.on('draw_settings', onSettings);

    return () => {
      socket.off('draw_state', onState);
      socket.off('draw_add', onAdd);
      socket.off('draw_update', onUpdate);
      socket.off('draw_move', onMove);
      socket.off('draw_remove', onRemove);
      socket.off('draw_clear', onClear);
      socket.off('draw_settings', onSettings);
    };
  }, [roomId]);

  // Keep the Transformer attached to the selected (resizable) shape.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const shape = shapes.find(s => s.id === selectedId);
    const node = selectedId ? shapeRefs.current.get(selectedId) : undefined;
    if (tool === 'move' && node && shape && RESIZABLE.has(shape.type)) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, tool, shapes]);

  // Leaving select mode clears the selection / Transformer.
  useEffect(() => {
    if (tool !== 'move') setSelectedId(null);
  }, [tool]);

  // Focus the text editor once it has mounted. Deferring past the click that
  // opened it avoids the browser blurring it immediately (an empty blur would
  // discard a brand-new text shape) and dodges the autoFocus-during-pointer race.
  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      if (!editing.isNew) el.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [editing]);

  const setNodeRef = (id: string, node: Konva.Node | null) => {
    if (node) shapeRefs.current.set(id, node);
    else shapeRefs.current.delete(id);
  };

  const newId = () =>
    `${getSocket().id ?? 'u'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Logical pointer position (accounts for the Stage transform).
  const getPos = () => stageRef.current?.getRelativePointerPosition() ?? null;

  // --- Local undo/redo: record each action and replay/reverse it via sockets --
  const pushOp = (op: Op) => {
    setUndoStack(prev => [...prev, op]);
    setRedoStack([]);
  };

  const emitAdd = (shape: DrawShape) => {
    setShapes(prev => [...prev.filter(s => s.id !== shape.id), shape]);
    getSocket().emit('draw_add', { roomId, shape });
  };
  const emitRemove = (id: string) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    getSocket().emit('draw_remove', { roomId, id });
  };
  const emitMove = (id: string, x: number, y: number) => {
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    getSocket().emit('draw_move', { roomId, id, x, y });
  };
  const emitUpdate = (shape: DrawShape) => {
    setShapes(prev => prev.map(s => (s.id === shape.id ? shape : s)));
    getSocket().emit('draw_update', { roomId, shape });
  };
  const emitClearAll = () => {
    setShapes([]);
    getSocket().emit('draw_clear', { roomId });
  };
  const restoreShapes = (toRestore: DrawShape[]) => {
    const ids = new Set(toRestore.map(s => s.id));
    setShapes(prev => [...prev.filter(s => !ids.has(s.id)), ...toRestore]);
    toRestore.forEach(shape => getSocket().emit('draw_add', { roomId, shape }));
  };

  const undo = () => {
    if (!canDraw || undoStack.length === 0) return;
    const op = undoStack[undoStack.length - 1];
    switch (op.type) {
      case 'add': emitRemove(op.shape.id); break;
      case 'remove': emitAdd(op.shape); break;
      case 'move': emitMove(op.id, op.from.x, op.from.y); break;
      case 'update': emitUpdate(op.before); break;
      case 'clear': restoreShapes(op.shapes); break;
    }
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, op]);
  };

  const redo = () => {
    if (!canDraw || redoStack.length === 0) return;
    const op = redoStack[redoStack.length - 1];
    switch (op.type) {
      case 'add': emitAdd(op.shape); break;
      case 'remove': emitRemove(op.shape.id); break;
      case 'move': emitMove(op.id, op.to.x, op.to.y); break;
      case 'update': emitUpdate(op.after); break;
      case 'clear': emitClearAll(); break;
    }
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, op]);
  };

  // --- Creating shapes (pen / rect / ellipse / arrow drag, text click) ------
  const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // A click anywhere while editing text commits it and consumes the click, so
    // it doesn't also start a new shape / text box on the same press.
    if (editing) {
      commitText();
      return;
    }
    if (tool === 'pan') return;
    if (tool === 'move') {
      // Click on empty canvas clears the selection.
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    if (tool === 'eraser') return; // handled by per-shape click
    if (!canDraw) return;

    const pos = getPos();
    if (!pos) return;

    if (tool === 'text') {
      startNewText(pos);
      return;
    }

    isDrawingRef.current = true;
    drawStartRef.current = pos;
    const id = newId();
    if (tool === 'pen') {
      setDraft({ id, type: 'line', points: [pos.x, pos.y], x: 0, y: 0, stroke: color, strokeWidth });
    } else if (tool === 'rect') {
      setDraft({ id, type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0, stroke: color, strokeWidth, fill: fillEnabled ? color : undefined });
    } else if (tool === 'ellipse') {
      setDraft({ id, type: 'ellipse', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0, stroke: color, strokeWidth, fill: fillEnabled ? color : undefined });
    } else if (tool === 'arrow') {
      setDraft({ id, type: 'arrow', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], stroke: color, strokeWidth, arrow: true });
    }
  };

  const handlePointerMove = () => {
    if (!isDrawingRef.current) return;
    const pos = getPos();
    if (!pos) return;
    const s = drawStartRef.current;
    setDraft(prev => {
      if (!prev) return prev;
      switch (prev.type) {
        case 'line': return { ...prev, points: [...prev.points, pos.x, pos.y] };
        case 'rect': return { ...prev, x: Math.min(s.x, pos.x), y: Math.min(s.y, pos.y), width: Math.abs(pos.x - s.x), height: Math.abs(pos.y - s.y) };
        case 'ellipse': return { ...prev, x: (s.x + pos.x) / 2, y: (s.y + pos.y) / 2, radiusX: Math.abs(pos.x - s.x) / 2, radiusY: Math.abs(pos.y - s.y) / 2 };
        case 'arrow': return { ...prev, points: [s.x, s.y, pos.x, pos.y] };
        default: return prev;
      }
    });
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const d = draft;
    setDraft(null);
    if (!d) return;
    // Discard zero-size / accidental shapes.
    if (d.type === 'line' && d.points.length < 4) return;
    if (d.type === 'rect' && (d.width < 2 || d.height < 2)) return;
    if (d.type === 'ellipse' && (d.radiusX < 1 || d.radiusY < 1)) return;
    if (d.type === 'arrow') {
      const [x1, y1, x2, y2] = d.points;
      if (Math.hypot(x2 - x1, y2 - y1) < 3) return;
    }
    setShapes(prev => [...prev, d]);
    getSocket().emit('draw_add', { roomId, shape: d });
    pushOp({ type: 'add', shape: d });
  };

  // --- Text tool: click to place, edit via an overlaid textarea --------------
  const startNewText = (pos: { x: number; y: number }) => {
    const shape: TextShape = { id: newId(), type: 'text', x: pos.x, y: pos.y, text: '', fontSize, fill: color };
    const ed = { id: shape.id, isNew: true };
    setShapes(prev => [...prev, shape]);
    editingRef.current = ed;
    setEditing(ed);
    setTextValue('');
  };

  const startEditText = (shape: TextShape) => {
    const ed = { id: shape.id, isNew: false };
    setSelectedId(null);
    editingRef.current = ed;
    setEditing(ed);
    setTextValue(shape.text);
  };

  const commitText = () => {
    const e = editing;
    // Guard: run once even if pointer-down and blur both call this.
    if (!e || editingRef.current !== e) return;
    editingRef.current = null;
    setEditing(null);
    const shape = shapes.find(s => s.id === e.id) as TextShape | undefined;
    if (!shape) return;
    const value = textValue.trim();

    if (e.isNew) {
      if (!value) { setShapes(prev => prev.filter(s => s.id !== e.id)); return; }
      const finalShape: TextShape = { ...shape, text: value };
      setShapes(prev => prev.map(s => (s.id === e.id ? finalShape : s)));
      getSocket().emit('draw_add', { roomId, shape: finalShape });
      pushOp({ type: 'add', shape: finalShape });
    } else {
      if (value === shape.text) return;
      if (!value) {
        setShapes(prev => prev.filter(s => s.id !== e.id));
        getSocket().emit('draw_remove', { roomId, id: e.id });
        pushOp({ type: 'remove', shape });
        return;
      }
      const after: TextShape = { ...shape, text: value };
      setShapes(prev => prev.map(s => (s.id === e.id ? after : s)));
      getSocket().emit('draw_update', { roomId, shape: after });
      pushOp({ type: 'update', before: shape, after });
    }
  };

  const cancelText = () => {
    const e = editing;
    if (!e || editingRef.current !== e) return;
    editingRef.current = null;
    setEditing(null);
    if (e.isNew) setShapes(prev => prev.filter(s => s.id !== e.id));
  };

  // --- Dragging an existing shape (select/move tool) ------------------------
  const handleDragStart = (id: string) => {
    draggingIdRef.current = id;
    setSelectedId(id);
    const s = shapes.find(sh => sh.id === id);
    dragStartRef.current = s ? { x: s.x, y: s.y } : { x: 0, y: 0 };
  };

  const handleDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const x = e.target.x();
    const y = e.target.y();
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    const now = Date.now();
    if (now - lastMoveEmitRef.current >= MOVE_THROTTLE_MS) {
      lastMoveEmitRef.current = now;
      getSocket().emit('draw_move', { roomId, id, x, y });
    }
  };

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const x = e.target.x();
    const y = e.target.y();
    draggingIdRef.current = null;
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    getSocket().emit('draw_move', { roomId, id, x, y });
    const from = dragStartRef.current;
    dragStartRef.current = null;
    if (from && (from.x !== x || from.y !== y)) {
      pushOp({ type: 'move', id, from, to: { x, y } });
    }
  };

  // --- Resize/rotate via the Transformer ------------------------------------
  const handleTransformEnd = (id: string) => {
    const node = shapeRefs.current.get(id);
    const shape = shapes.find(s => s.id === id);
    if (!node || !shape) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const common = { x: node.x(), y: node.y(), rotation: node.rotation() };
    let after: DrawShape;
    switch (shape.type) {
      case 'rect':
        after = { ...shape, ...common, width: Math.max(2, shape.width * scaleX), height: Math.max(2, shape.height * scaleY) };
        break;
      case 'ellipse':
        after = { ...shape, ...common, radiusX: Math.max(1, shape.radiusX * scaleX), radiusY: Math.max(1, shape.radiusY * scaleY) };
        break;
      case 'image':
        after = { ...shape, ...common, width: Math.max(2, shape.width * scaleX), height: Math.max(2, shape.height * scaleY) };
        break;
      case 'text':
        after = { ...shape, ...common, width: Math.max(20, (shape.width ?? node.width()) * scaleX), fontSize: Math.max(6, shape.fontSize * scaleY) };
        break;
      default:
        return;
    }
    setShapes(prev => prev.map(s => (s.id === id ? after : s)));
    getSocket().emit('draw_update', { roomId, shape: after });
    pushOp({ type: 'update', before: shape, after });
  };

  // --- Click a shape: select (move tool) or erase (eraser tool) -------------
  const handleShapeClick = (shape: DrawShape) => {
    if (tool === 'eraser') {
      if (!canDraw) return;
      setShapes(prev => prev.filter(s => s.id !== shape.id));
      getSocket().emit('draw_remove', { roomId, id: shape.id });
      pushOp({ type: 'remove', shape });
    } else if (tool === 'move') {
      setSelectedId(shape.id);
    }
  };

  // --- Image import: pick a file, upload, place it on the board --------------
  const openImagePicker = () => fileInputRef.current?.click();

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Imagem muito grande (máx. 5MB).');
      return;
    }
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post(`/room/${roomId}/upload`, form);
      const url: string = res.data.url;
      // Read natural dimensions and scale to fit the import box.
      const probe = new window.Image();
      probe.onload = () => {
        const ratio = Math.min(1, IMPORT_MAX_DIM / Math.max(probe.width, probe.height));
        const w = Math.max(1, Math.round(probe.width * ratio));
        const h = Math.max(1, Math.round(probe.height * ratio));
        const shape: ImageShape = {
          id: newId(),
          type: 'image',
          src: url,
          x: Math.max(0, (canvasWidth - w) / 2),
          y: Math.max(0, (canvasHeight - h) / 2),
          width: w,
          height: h,
        };
        setShapes(prev => [...prev, shape]);
        getSocket().emit('draw_add', { roomId, shape });
        pushOp({ type: 'add', shape });
        setTool('move');
        setSelectedId(shape.id);
      };
      probe.src = API_BASE + url;
    } catch (err: any) {
      alert('Falha ao enviar imagem: ' + (err.response?.data?.message ?? 'erro'));
    }
  };

  const handleClear = () => {
    if (!canDraw || shapes.length === 0) return;
    if (!window.confirm('Limpar todo o quadro para todos?')) return;
    const cleared = shapes;
    setShapes([]);
    setSelectedId(null);
    getSocket().emit('draw_clear', { roomId });
    pushOp({ type: 'clear', shapes: cleared });
  };

  const toggleOwnerOnly = () => {
    if (!isOwner) return;
    const next = !drawingOwnerOnly;
    setDrawingOwnerOnly(next);
    getSocket().emit('draw_settings', { roomId, drawingOwnerOnly: next });
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isOwner) return;
    const [w, h] = e.target.value.split('x').map(Number);
    if (!w || !h) return;
    setCanvasWidth(w);
    setCanvasHeight(h);
    getSocket().emit('draw_settings', { roomId, canvasWidth: w, canvasHeight: h });
  };

  // Renders a single shape (interactive board shape, or the non-interactive
  // in-progress draft when `interactive` is false).
  const renderShape = (shape: DrawShape, interactive: boolean) => {
    const draggable = interactive && canDraw && tool === 'move';
    const handlers = interactive
      ? {
          onClick: () => handleShapeClick(shape),
          onTap: () => handleShapeClick(shape),
          onDragStart: () => handleDragStart(shape.id),
          onDragMove: (ev: Konva.KonvaEventObject<DragEvent>) => handleDragMove(shape.id, ev),
          onDragEnd: (ev: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(shape.id, ev),
          onTransformEnd: () => handleTransformEnd(shape.id),
        }
      : {};
    const ref = interactive ? (n: Konva.Node | null) => setNodeRef(shape.id, n) : undefined;

    switch (shape.type) {
      case 'line':
        return (
          <Line
            key={shape.id}
            ref={ref as any}
            points={shape.points}
            x={shape.x}
            y={shape.y}
            rotation={shape.rotation ?? 0}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            hitStrokeWidth={Math.max(shape.strokeWidth, 32)}
            lineCap="round"
            lineJoin="round"
            tension={0.3}
            draggable={draggable}
            {...handlers}
          />
        );
      case 'rect':
        return (
          <Rect
            key={shape.id}
            ref={ref as any}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rotation={shape.rotation ?? 0}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.fill}
            draggable={draggable}
            {...handlers}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            key={shape.id}
            ref={ref as any}
            x={shape.x}
            y={shape.y}
            radiusX={shape.radiusX}
            radiusY={shape.radiusY}
            rotation={shape.rotation ?? 0}
            stroke={shape.stroke}
            strokeWidth={shape.strokeWidth}
            fill={shape.fill}
            draggable={draggable}
            {...handlers}
          />
        );
      case 'arrow':
        return (
          <Arrow
            key={shape.id}
            ref={ref as any}
            points={shape.points}
            x={shape.x}
            y={shape.y}
            rotation={shape.rotation ?? 0}
            stroke={shape.stroke}
            fill={shape.stroke}
            strokeWidth={shape.strokeWidth}
            hitStrokeWidth={Math.max(shape.strokeWidth, 32)}
            pointerLength={10}
            pointerWidth={10}
            draggable={draggable}
            {...handlers}
          />
        );
      case 'text':
        return (
          <Text
            key={shape.id}
            ref={ref as any}
            text={shape.text}
            x={shape.x}
            y={shape.y}
            rotation={shape.rotation ?? 0}
            fontSize={shape.fontSize}
            fill={shape.fill}
            width={shape.width}
            visible={editing?.id !== shape.id}
            draggable={draggable}
            onDblClick={interactive ? () => startEditText(shape) : undefined}
            onDblTap={interactive ? () => startEditText(shape) : undefined}
            {...handlers}
          />
        );
      case 'image':
        return (
          <URLImage
            key={shape.id}
            shape={shape}
            draggable={draggable}
            onSelect={() => handleShapeClick(shape)}
            onDragStart={() => handleDragStart(shape.id)}
            onDragMove={ev => handleDragMove(shape.id, ev)}
            onDragEnd={ev => handleDragEnd(shape.id, ev)}
            onTransformEnd={() => handleTransformEnd(shape.id)}
            registerRef={n => setNodeRef(shape.id, n)}
          />
        );
      default:
        return null;
    }
  };

  // Show the current size as an option even if it isn't one of the presets.
  const currentSize = `${canvasWidth}x${canvasHeight}`;
  const sizeOptions = CANVAS_SIZES.some(s => `${s.w}x${s.h}` === currentSize)
    ? CANVAS_SIZES
    : [{ w: canvasWidth, h: canvasHeight }, ...CANVAS_SIZES];

  const editingShape = editing ? (shapes.find(s => s.id === editing.id) as TextShape | undefined) : undefined;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          {([
            { id: 'pen', icon: '✏️', label: 'Desenhar', requiresDraw: true },
            { id: 'rect', icon: '▭', label: 'Retângulo', requiresDraw: true },
            { id: 'ellipse', icon: '◯', label: 'Elipse', requiresDraw: true },
            { id: 'arrow', icon: '↗', label: 'Seta', requiresDraw: true },
            { id: 'text', icon: 'T', label: 'Texto', requiresDraw: true },
            { id: 'image', icon: '🖼️', label: 'Imagem', requiresDraw: true },
            { id: 'move', icon: '✋', label: 'Selecionar / mover', requiresDraw: true },
            { id: 'eraser', icon: '🧽', label: 'Apagar', requiresDraw: true },
            { id: 'pan', icon: '🧭', label: 'Navegar (arrastar tela)', requiresDraw: false },
          ] as const).map(t => (
            <span key={t.id} className={styles.tooltip} data-tip={t.label}>
              <Button
                variant={tool === t.id ? 'primary' : 'neutral'}
                onClick={() => (t.id === 'image' ? openImagePicker() : setTool(t.id))}
                disabled={t.requiresDraw && !canDraw}
                aria-label={t.label}
                style={{ width: 40, height: 40, padding: 0, fontSize: '1.1rem' }}
              >
                {t.icon}
              </Button>
            </span>
          ))}
        </div>

        <div className={styles.toolGroup}>
          <span className={styles.tooltip} data-tip="Desfazer">
            <Button variant="neutral" onClick={undo} disabled={!canDraw || undoStack.length === 0}
              aria-label="Desfazer" style={{ width: 40, height: 40, padding: 0, fontSize: '1.1rem' }}>
              ↶
            </Button>
          </span>
          <span className={styles.tooltip} data-tip="Refazer">
            <Button variant="neutral" onClick={redo} disabled={!canDraw || redoStack.length === 0}
              aria-label="Refazer" style={{ width: 40, height: 40, padding: 0, fontSize: '1.1rem' }}>
              ↷
            </Button>
          </span>
        </div>

        <div className={styles.palette}>
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              aria-label={`cor ${c}`}
              className={`${styles.swatch} ${color === c ? styles.swatchActive : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              disabled={!canDraw}
            />
          ))}
        </div>

        <div className={styles.toolGroup}>
          <label className={styles.widthLabel}>
            Espessura
            <input type="range" min={1} max={24} value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))} disabled={!canDraw} />
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={fillEnabled} onChange={e => setFillEnabled(e.target.checked)} disabled={!canDraw} />
            Preencher
          </label>
          {tool === 'text' && (
            <label className={styles.widthLabel}>
              Fonte
              <input type="range" min={8} max={96} value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))} disabled={!canDraw} />
            </label>
          )}
          <Button variant="danger" onClick={handleClear} disabled={!canDraw}>
            Limpar tudo
          </Button>
        </div>

        {isOwner && (
          <div className={styles.ownerSettings}>
            <label className={styles.betaToggle}>
              <input type="checkbox" checked={drawingOwnerOnly} onChange={toggleOwnerOnly} />
              Apenas o dono pode desenhar <span className={styles.betaTag}>beta</span>
            </label>
            <label className={styles.sizeControl}>
              Tamanho
              <select value={currentSize} onChange={handleSizeChange}>
                {sizeOptions.map(s => (
                  <option key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>{s.w} × {s.h}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {!canDraw && (
        <p className={styles.notice}>
          O dono ativou o modo somente-leitura: apenas ele pode desenhar no quadro.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />

      <div className={styles.stageContainer}>
        <div className={styles.board} style={{ width: canvasWidth, height: canvasHeight }}>
          <Stage
            ref={stageRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchEnd={handlePointerUp}
            onMouseLeave={handlePointerUp}
            // With the Pan tool, hand touch back to the browser so a one-finger
            // swipe scrolls the board natively; otherwise Konva owns touch.
            preventDefault={tool !== 'pan'}
            style={{
              cursor: tool === 'pan' ? 'grab' : canDraw && tool !== 'move' ? 'crosshair' : 'default',
              touchAction: tool === 'pan' ? 'pan-x pan-y' : 'none',
            }}
          >
            <Layer>
              {shapes.map(shape => renderShape(shape, true))}
              {draft && renderShape(draft, false)}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                ignoreStroke
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>

          {editing && editingShape && (
            <textarea
              ref={textareaRef}
              className={styles.textEditor}
              style={{
                left: editingShape.x,
                top: editingShape.y,
                fontSize: editingShape.fontSize,
                color: editingShape.fill,
                width: editingShape.width ?? 240,
              }}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onBlur={commitText}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelText();
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
