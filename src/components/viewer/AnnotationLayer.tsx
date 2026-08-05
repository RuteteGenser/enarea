import { useRef } from 'react';
import { formatArea, formatLength, metersPerUnit } from '@/lib/calibration';
import { distance, polygonArea } from '@/lib/geometry';
import ShapeRenderer from '@/components/viewer/ShapeRenderer';
import SelectionHandles from '@/components/viewer/SelectionHandles';
import { useDrawTool } from '@/components/tools/useDrawTool';
import { useSelectTool } from '@/components/tools/useSelectTool';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Calibration, Point, Unit } from '@/types';

type AnnotationLayerProps = {
  fileId: string;
  zoom: number;
  width: number;
  height: number;
  calibration: Calibration;
  unit: Unit;
};

function toScreen(p: Point, zoom: number) {
  return { x: p.x * zoom, y: p.y * zoom };
}

export default function AnnotationLayer({ fileId, zoom, width, height, calibration, unit }: AnnotationLayerProps) {
  const tool = useViewportStore((s) => s.tool);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectedId = useAnnotationStore((s) => s.selectedId);
  const setSelected = useAnnotationStore((s) => s.setSelected);
  const setEdgeMeta = useAnnotationStore((s) => s.setEdgeMeta);

  const svgRef = useRef<SVGSVGElement>(null);
  const { points, cursor, snapped, dragPreviewPoints, handlers } = useDrawTool(tool, fileId, zoom);
  const { livePointsFor, startVertexDrag, insertPoint } = useSelectTool(zoom, svgRef);

  const mpu = metersPerUnit(calibration);
  const isSelectTool = tool === 'select';
  const selectedAnnotation = annotations.find((a) => a.id === selectedId);

  let previewLabel: { pos: Point; text: string } | null = null;
  let previewShape: React.ReactNode = null;

  if (tool === 'line' && points.length === 1 && cursor) {
    const a = toScreen(points[0], zoom);
    const b = toScreen(cursor, zoom);
    previewShape = <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0091ff" strokeWidth={2} strokeDasharray="6 4" />;
    const meters = distance(points[0], cursor) * mpu;
    previewLabel = { pos: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 12 }, text: formatLength(meters, unit) };
  } else if (tool === 'polygon' && points.length >= 1 && cursor) {
    const screenPts = [...points, cursor].map((p) => toScreen(p, zoom));
    const pathD = screenPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    previewShape = <path d={pathD} fill="none" stroke="#0091ff" strokeWidth={2} strokeDasharray="6 4" />;
    if (points.length >= 2) {
      const squareMeters = polygonArea([...points, cursor]) * mpu * mpu;
      const last = screenPts[screenPts.length - 1];
      previewLabel = { pos: { x: last.x, y: last.y - 12 }, text: formatArea(squareMeters, unit) };
    }
  } else if (tool === 'rectangle' && dragPreviewPoints) {
    const screenPts = dragPreviewPoints.map((p) => toScreen(p, zoom));
    const pointsAttr = screenPts.map((p) => `${p.x},${p.y}`).join(' ');
    previewShape = (
      <polygon points={pointsAttr} fill="#0091ff" fillOpacity={0.1} stroke="#0091ff" strokeWidth={2} strokeDasharray="6 4" />
    );
    const squareMeters = polygonArea(dragPreviewPoints) * mpu * mpu;
    previewLabel = { pos: { x: screenPts[2].x, y: screenPts[2].y - 12 }, text: formatArea(squareMeters, unit) };
  }

  const snappedScreen = snapped ? toScreen(snapped, zoom) : null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        cursor: isSpaceDown ? undefined : tool === 'select' ? 'default' : tool === 'pan' ? undefined : 'crosshair',
      }}
      onMouseMove={handlers.onMouseMove}
      onMouseDown={handlers.onMouseDown}
      onMouseUp={handlers.onMouseUp}
      onClick={(e) => {
        handlers.onClick(e);
        if (isSelectTool && !isSpaceDown && e.target === e.currentTarget) setSelected(null);
      }}
      onDoubleClick={handlers.onDoubleClick}
    >
      {annotations.map((annotation) => (
        <ShapeRenderer
          key={annotation.id}
          annotation={annotation}
          points={livePointsFor(annotation.id) ?? undefined}
          zoom={zoom}
          calibration={calibration}
          unit={unit}
          selected={annotation.id === selectedId}
          onSelect={isSelectTool && !isSpaceDown ? setSelected : undefined}
        />
      ))}

      {isSelectTool && selectedAnnotation && (
        <SelectionHandles
          annotation={selectedAnnotation}
          points={livePointsFor(selectedAnnotation.id) ?? selectedAnnotation.points}
          zoom={zoom}
          onVertexMouseDown={(index, e) => startVertexDrag(selectedAnnotation, index, e)}
          onInsertPoint={(edgeIndex, point) => insertPoint(selectedAnnotation, edgeIndex, point)}
          onEdgeMetaChange={(edgeIndex, meta) => setEdgeMeta(selectedAnnotation.id, edgeIndex, meta)}
        />
      )}

      {previewShape}

      {points.map((p, i) => {
        const s = toScreen(p, zoom);
        return <circle key={i} cx={s.x} cy={s.y} r={4} fill="#0091ff" />;
      })}

      {previewLabel && (
        <text
          x={previewLabel.pos.x}
          y={previewLabel.pos.y}
          fontSize={11}
          textAnchor="middle"
          className="select-none fill-foreground"
          style={{ fontWeight: 500 }}
        >
          {previewLabel.text}
        </text>
      )}

      {snappedScreen && (
        <circle cx={snappedScreen.x} cy={snappedScreen.y} r={7} fill="none" stroke="#0091ff" strokeWidth={1.5} />
      )}
    </svg>
  );
}
