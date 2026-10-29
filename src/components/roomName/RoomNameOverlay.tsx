import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import type { PdfPageProxy } from '@/lib/pdf';
import { areaAtPoint } from '@/lib/personMarkers';
import { applyRoomNameAndMatch } from '@/lib/roomTemplateMatch';
import { findRoomLabel, type RoomLabel, type TextBox } from '@/lib/roomLabel';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

type RoomNameOverlayProps = { page: PdfPageProxy | null; zoom: number; width: number; height: number };

/** Reads all text of the page into boxes in page coordinates (same space as the annotations). */
async function readTextBoxes(page: PdfPageProxy): Promise<TextBox[]> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const boxes: TextBox[] = [];
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const [a, , , d, e, f] = item.transform;
    const fontHeight = item.height || Math.abs(d) || Math.abs(a);
    const [x1, y1] = viewport.convertToViewportPoint(e, f);
    const [x2, y2] = viewport.convertToViewportPoint(e + item.width, f + fontHeight);
    boxes.push({ str: item.str, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
  }
  return boxes;
}

/**
 * Tool "Gjenkjenn romnavn": click a room name or number on the drawing. The text and its neighbours
 * (name above/below/beside the number) are read from the PDF, and the area the click is in gets that
 * name and room number.
 */
export default function RoomNameOverlay({ page, zoom, width, height }: RoomNameOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [hover, setHover] = useState<{ label: RoomLabel; area: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBoxes([]);
    if (page) {
      void readTextBoxes(page).then((b) => {
        if (!cancelled) setBoxes(b);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [page]);

  function toPdf(e: ReactMouseEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  /** The label under the point, using only text that lies in the same area as the click. */
  function labelAt(point: Point) {
    const area = areaAtPoint(annotations, point);
    if (!area) return null;
    const sameArea = (b: TextBox) => areaAtPoint(annotations, { x: b.x + b.w / 2, y: b.y + b.h / 2 })?.id === area.id;
    const label = findRoomLabel(boxes, point, sameArea);
    return label ? { label, area } : null;
  }

  function handleClick(e: ReactMouseEvent) {
    if (isSpaceDown || e.button !== 0) return;
    const point = toPdf(e);
    const area = areaAtPoint(annotations, point);
    if (!area) {
      toast.warning('Klikk på romnavn eller romnummer inni et område');
      return;
    }
    if (area.locked) {
      toast.warning('Området er låst');
      return;
    }
    const found = labelAt(point);
    if (!found) {
      toast.error(boxes.length === 0 ? 'Fant ingen tekst i PDF-en (er den skannet?)' : 'Fant ikke romnavn eller romnummer her');
      return;
    }
    const { label } = found;
    if (label.name) applyRoomNameAndMatch(area.id, label.name, label.number ? { roomNumber: label.number } : undefined);
    else if (label.number) useAnnotationStore.getState().updateAnnotation(area.id, { roomNumber: label.number });
    toast.success(`${[label.number, label.name].filter(Boolean).join(' ')} ble satt på området`);
  }

  const box = hover?.label.box;

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-crosshair')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={(e) => {
        if (isSpaceDown) return;
        const found = labelAt(toPdf(e));
        setHover(found ? { label: found.label, area: found.area.id } : null);
      }}
      onMouseLeave={() => setHover(null)}
      onClick={handleClick}
    >
      {hover && box && (
        <g pointerEvents="none">
          <rect
            x={box.x * zoom - 3}
            y={box.y * zoom - 3}
            width={box.w * zoom + 6}
            height={box.h * zoom + 6}
            rx={3}
            fill="#0091ff"
            fillOpacity={0.12}
            stroke="#0091ff"
            strokeWidth={1.5}
          />
          <g transform={`translate(${(box.x + box.w / 2) * zoom}, ${box.y * zoom - 14})`}>
            <rect x={-70} y={-9} width={140} height={18} rx={4} className="fill-card stroke-primary" strokeWidth={1} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600} className="select-none fill-foreground">
              {[hover.label.number, hover.label.name].filter(Boolean).join(' · ')}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
