import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { bearingBetween } from '@/lib/north';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

/** First half of the compass calibration: paste a screenshot (north up) and measure a wall against north. */
export default function NorthCalibrationDialog() {
  const open = useViewportStore((s) => s.northDialogOpen);
  const setOpen = useViewportStore((s) => s.setNorthDialogOpen);
  const setBearing = useViewportStore((s) => s.setNorthScreenshotBearing);
  const setTool = useViewportStore((s) => s.setTool);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]); // in natural image pixels
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setImage(blob: Blob) {
    setImageUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    setPoints([]);
  }

  // Ctrl+V anywhere while the dialog is open.
  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      e.preventDefault();
      setImage(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setImageUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setPoints([]);
  }, [open]);

  function toNatural(e: ReactMouseEvent<HTMLImageElement>): Point {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * img.naturalWidth,
      y: ((e.clientY - rect.top) / rect.height) * img.naturalHeight,
    };
  }

  function handleImageClick(e: ReactMouseEvent<HTMLImageElement>) {
    const p = toNatural(e);
    setPoints((current) => (current.length === 1 ? [current[0], p] : [p]));
  }

  const bearing = points.length === 2 ? bearingBetween(points[0], points[1]) : null;
  const img = imgRef.current;
  const toView = (p: Point) => (img ? { x: (p.x / img.naturalWidth) * img.clientWidth, y: (p.y / img.naturalHeight) * img.clientHeight } : p);

  function next() {
    if (bearing === null) return;
    setBearing(bearing);
    setOpen(false);
    setTool('north');
    toast.info('Klikk to punkter langs samme vegg på tegningen, fra samme ende som i skjermbildet. Esc avbryter.');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kalibrer nord med skjermbilde</DialogTitle>
          <DialogDescription>
            Lim inn et skjermbilde der nord peker rett opp (for eksempel et kartutsnitt av bygget), og klikk to punkter
            langs en vegg. Deretter markerer du samme vegg på tegningen, fra samme ende.
          </DialogDescription>
        </DialogHeader>

        {imageUrl ? (
          <div className="relative mx-auto w-fit max-w-full select-none">
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Skjermbilde"
              draggable={false}
              onClick={handleImageClick}
              onLoad={() => setPoints([])}
              className="max-h-[55vh] max-w-full cursor-crosshair rounded border border-border"
            />
            {img && points.length > 0 && (
              <svg className="pointer-events-none absolute inset-0" width={img.clientWidth} height={img.clientHeight}>
                {points.length === 2 && (
                  <line
                    x1={toView(points[0]).x}
                    y1={toView(points[0]).y}
                    x2={toView(points[1]).x}
                    y2={toView(points[1]).y}
                    stroke="#0091ff"
                    strokeWidth={2}
                  />
                )}
                {points.map((p, i) => (
                  <circle key={i} cx={toView(p).x} cy={toView(p).y} r={4} fill={i === 0 ? '#f5a623' : '#0091ff'} />
                ))}
              </svg>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file?.type.startsWith('image/')) setImage(file);
            }}
            className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-secondary/50"
          >
            <ImagePlus className="size-6" />
            Lim inn skjermbilde (Ctrl+V), slipp en fil her, eller klikk for å velge fil
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setImage(file);
            e.target.value = '';
          }}
        />

        {imageUrl && (
          <p className="text-sm text-muted-foreground">
            {bearing === null
              ? points.length === 0
                ? 'Klikk i den ene enden av veggen (start), deretter i den andre.'
                : 'Klikk i den andre enden av veggen.'
              : `Veggen peker ${Math.round(bearing)}° fra nord (med klokken). Klikk på nytt for å måle om igjen.`}
          </p>
        )}

        <DialogFooter>
          {imageUrl && (
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Bytt bilde
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={bearing === null} onClick={next}>
            Videre: marker veggen på tegningen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
