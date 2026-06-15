import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type Konva from 'konva';
import { getSocket } from '../../utils/socket';
import { Button } from '../../components/ui/Button';
import styles from './RoomCanvas.module.css';

// A freehand stroke. `points` is a flat [x0,y0,x1,y1,...] array in the board's
// logical coordinate space; `x`/`y` are the stroke's drag offset.
interface DrawShape {
  id: string;
  points: number[];
  x: number;
  y: number;
  stroke: string;
  strokeWidth: number;
}

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

// Throttle live drag emissions: at most one socket message per this interval to
// avoid flooding the network during a drag (the final position is sent on drop).
const MOVE_THROTTLE_MS = 30;

// Classic 2-row palette (saturated row on top, light/pastel row below).
// Rendered into a 10-column grid so the two rows line up like a paint palette.
const COLORS = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27',
  '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e',
  '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
];

// 'pan' is a view-navigation tool (not a board edit): it hands touch back to the
// browser so one-finger swipe scrolls the board on phones. It's the only tool
// usable in read-only mode, since navigating isn't drawing.
type Tool = 'pen' | 'move' | 'eraser' | 'pan';

// A reversible board action by this client, used for local undo/redo. Each op
// records what changed; undo/redo replay it via the normal socket events so
// every other client stays in sync.
type Op =
  | { type: 'add'; shape: DrawShape }
  | { type: 'remove'; shape: DrawShape }
  | { type: 'move'; id: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'clear'; shapes: DrawShape[] };

interface RoomCanvasProps {
  roomId: string;
}

export function RoomCanvas({ roomId }: RoomCanvasProps) {
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [currentLine, setCurrentLine] = useState<DrawShape | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [drawingOwnerOnly, setDrawingOwnerOnly] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_W);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_H);
  const [undoStack, setUndoStack] = useState<Op[]>([]);
  const [redoStack, setRedoStack] = useState<Op[]>([]);

  const stageRef = useRef<Konva.Stage>(null);
  const isDrawingRef = useRef(false);
  // The id of the stroke this client is actively dragging, so remote moves for
  // the same stroke are ignored locally (prevents "fighting" cursors).
  const draggingIdRef = useRef<string | null>(null);
  // The dragged stroke's position when the drag began, recorded for undo.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMoveEmitRef = useRef(0);

  const canDraw = !drawingOwnerOnly || isOwner;

  // --- Socket wiring: request current state and listen for remote updates ---
  useEffect(() => {
    const socket = getSocket();

    socket.emit('draw_request_state', roomId);

    const onState = (data: {
      shapes: DrawShape[];
      drawingOwnerOnly: boolean;
      canvasWidth: number;
      canvasHeight: number;
      isOwner: boolean;
    }) => {
      setShapes(data.shapes ?? []);
      setDrawingOwnerOnly(!!data.drawingOwnerOnly);
      setIsOwner(!!data.isOwner);
      if (data.canvasWidth) setCanvasWidth(data.canvasWidth);
      if (data.canvasHeight) setCanvasHeight(data.canvasHeight);
    };

    const onAdd = ({ shape }: { shape: DrawShape }) => {
      setShapes(prev => [...prev.filter(s => s.id !== shape.id), shape]);
    };

    const onMove = ({ id, x, y }: { id: string; x: number; y: number }) => {
      // The server is the source of truth, but if we're mid-drag on this exact
      // stroke we keep our local position to avoid the two cursors fighting.
      if (draggingIdRef.current === id) return;
      setShapes(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    };

    const onRemove = ({ id }: { id: string }) => {
      setShapes(prev => prev.filter(s => s.id !== id));
    };

    const onClear = () => setShapes([]);

    const onSettings = (data: {
      drawingOwnerOnly: boolean;
      canvasWidth?: number;
      canvasHeight?: number;
    }) => {
      setDrawingOwnerOnly(!!data.drawingOwnerOnly);
      if (data.canvasWidth) setCanvasWidth(data.canvasWidth);
      if (data.canvasHeight) setCanvasHeight(data.canvasHeight);
    };

    socket.on('draw_state', onState);
    socket.on('draw_add', onAdd);
    socket.on('draw_move', onMove);
    socket.on('draw_remove', onRemove);
    socket.on('draw_clear', onClear);
    socket.on('draw_settings', onSettings);

    return () => {
      socket.off('draw_state', onState);
      socket.off('draw_add', onAdd);
      socket.off('draw_move', onMove);
      socket.off('draw_remove', onRemove);
      socket.off('draw_clear', onClear);
      socket.off('draw_settings', onSettings);
    };
  }, [roomId]);

  // Logical pointer position (accounts for the Stage scale).
  const getPos = () => stageRef.current?.getRelativePointerPosition() ?? null;

  // --- Local undo/redo: record each action and replay/reverse it via sockets ---
  const pushOp = (op: Op) => {
    setUndoStack(prev => [...prev, op]);
    setRedoStack([]); // a fresh action invalidates the redo branch
  };

  // Apply-and-broadcast primitives shared by undo and redo.
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
      case 'clear': emitClearAll(); break;
    }
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, op]);
  };

  // --- Freehand drawing (pen tool) ---
  const handlePointerDown = () => {
    if (tool !== 'pen' || !canDraw) return;
    const pos = getPos();
    if (!pos) return;
    isDrawingRef.current = true;
    setCurrentLine({
      id: `${getSocket().id ?? 'u'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      points: [pos.x, pos.y],
      x: 0,
      y: 0,
      stroke: color,
      strokeWidth,
    });
  };

  const handlePointerMove = () => {
    if (!isDrawingRef.current) return;
    const pos = getPos();
    if (!pos) return;
    setCurrentLine(prev =>
      prev ? { ...prev, points: [...prev.points, pos.x, pos.y] } : prev
    );
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const line = currentLine;
    setCurrentLine(null);
    // Discard taps that didn't produce an actual stroke.
    if (!line || line.points.length < 4) return;
    setShapes(prev => [...prev, line]);
    // Send the completed stroke once (minimal: only this stroke, not the board).
    getSocket().emit('draw_add', { roomId, shape: line });
    pushOp({ type: 'add', shape: line });
  };

  // --- Dragging an existing stroke (move tool) ---
  const handleDragStart = (id: string) => {
    draggingIdRef.current = id;
    const s = shapes.find(sh => sh.id === id);
    dragStartRef.current = s ? { x: s.x, y: s.y } : { x: 0, y: 0 };
  };

  const handleDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const x = e.target.x();
    const y = e.target.y();
    // Keep local state in sync so React re-renders don't snap the node back.
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    // Throttle the realtime emissions to avoid flooding the socket.
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
    // Always send the exact final position (the throttle may have skipped it).
    getSocket().emit('draw_move', { roomId, id, x, y });
    const from = dragStartRef.current;
    dragStartRef.current = null;
    if (from && (from.x !== x || from.y !== y)) {
      pushOp({ type: 'move', id, from, to: { x, y } });
    }
  };

  // --- Eraser: click a stroke to delete it ---
  const handleShapeClick = (id: string) => {
    if (tool !== 'eraser' || !canDraw) return;
    const shape = shapes.find(s => s.id === id);
    setShapes(prev => prev.filter(s => s.id !== id));
    getSocket().emit('draw_remove', { roomId, id });
    if (shape) pushOp({ type: 'remove', shape });
  };

  const handleClear = () => {
    if (!canDraw || shapes.length === 0) return;
    if (!window.confirm('Limpar todo o quadro para todos?')) return;
    const cleared = shapes;
    setShapes([]);
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

  // Show the current size as an option even if it isn't one of the presets.
  const currentSize = `${canvasWidth}x${canvasHeight}`;
  const sizeOptions = CANVAS_SIZES.some(s => `${s.w}x${s.h}` === currentSize)
    ? CANVAS_SIZES
    : [{ w: canvasWidth, h: canvasHeight }, ...CANVAS_SIZES];

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          {([
            { id: 'pen', icon: '✏️', label: 'Desenhar', requiresDraw: true },
            { id: 'move', icon: '✋', label: 'Mover objeto', requiresDraw: true },
            { id: 'eraser', icon: '🧽', label: 'Apagar', requiresDraw: true },
            { id: 'pan', icon: '🧭', label: 'Navegar (arrastar tela)', requiresDraw: false },
          ] as const).map(t => (
            <span key={t.id} className={styles.tooltip} data-tip={t.label}>
              <Button
                variant={tool === t.id ? 'primary' : 'neutral'}
                onClick={() => setTool(t.id)}
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
            <Button
              variant="neutral"
              onClick={undo}
              disabled={!canDraw || undoStack.length === 0}
              aria-label="Desfazer"
              style={{ width: 40, height: 40, padding: 0, fontSize: '1.1rem' }}
            >
              ↶
            </Button>
          </span>
          <span className={styles.tooltip} data-tip="Refazer">
            <Button
              variant="neutral"
              onClick={redo}
              disabled={!canDraw || redoStack.length === 0}
              aria-label="Refazer"
              style={{ width: 40, height: 40, padding: 0, fontSize: '1.1rem' }}
            >
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
            <input
              type="range"
              min={1}
              max={24}
              value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
              disabled={!canDraw}
            />
          </label>
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
                  <option key={`${s.w}x${s.h}`} value={`${s.w}x${s.h}`}>
                    {s.w} × {s.h}
                  </option>
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
          // swipe scrolls the board natively; otherwise Konva owns touch and
          // suppresses scrolling so drawing/dragging works.
          preventDefault={tool !== 'pan'}
          style={{
            cursor:
              tool === 'pan' ? 'grab' : canDraw && tool === 'pen' ? 'crosshair' : 'default',
            touchAction: tool === 'pan' ? 'pan-x pan-y' : 'none',
          }}
        >
          <Layer>
            {shapes.map(shape => (
              <Line
                key={shape.id}
                points={shape.points}
                x={shape.x}
                y={shape.y}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                // Widen only the invisible hit region so thin strokes are still
                // easy to grab (move) or click (erase) with a fingertip on touch.
                hitStrokeWidth={Math.max(shape.strokeWidth, 32)}
                lineCap="round"
                lineJoin="round"
                tension={0.3}
                draggable={canDraw && tool === 'move'}
                onDragStart={() => handleDragStart(shape.id)}
                onDragMove={e => handleDragMove(shape.id, e)}
                onDragEnd={e => handleDragEnd(shape.id, e)}
                onClick={() => handleShapeClick(shape.id)}
                onTap={() => handleShapeClick(shape.id)}
              />
            ))}
            {currentLine && (
              <Line
                points={currentLine.points}
                x={currentLine.x}
                y={currentLine.y}
                stroke={currentLine.stroke}
                strokeWidth={currentLine.strokeWidth}
                lineCap="round"
                lineJoin="round"
                tension={0.3}
              />
            )}
          </Layer>
        </Stage>
        </div>
      </div>
    </div>
  );
}
