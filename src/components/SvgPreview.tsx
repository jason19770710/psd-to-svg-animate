import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { LayerInfo, AnimationConfig } from "@/types/psd";
import { generateAnimationCSS } from "@/lib/svg-export";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface SvgPreviewProps {
  layers: LayerInfo[];
  animations: Record<string, AnimationConfig>;
  canvasWidth: number;
  canvasHeight: number;
  selectedId: string | null;
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, left: number, top: number) => void;
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function SvgPreview({ layers, animations, canvasWidth, canvasHeight, selectedId, onSelectLayer, onMoveLayer }: SvgPreviewProps) {
  const css = useMemo(() => generateAnimationCSS(layers, animations), [layers, animations]);
  const visibleLayers = layers.filter((l) => l.visible);
  const renderLayers = [...visibleLayers].reverse();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState(false);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origLeft: number; origTop: number } | null>(null);

  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const padded = 32;
    const scaleX = (el.clientWidth - padded) / canvasWidth;
    const scaleY = (el.clientHeight - padded) / canvasHeight;
    setZoom(Math.min(scaleX, scaleY, 1));
  }, [canvasWidth, canvasHeight]);

  // Auto-fit on first load
  useEffect(() => {
    if (!fitted && containerRef.current) {
      fitToScreen();
      setFitted(true);
    }
  }, [fitted, fitToScreen]);

  const zoomIn = () => {
    setZoom((z) => {
      const next = ZOOM_STEPS.find((s) => s > z + 0.001);
      return next ?? z;
    });
  };

  const zoomOut = () => {
    setZoom((z) => {
      const prev = [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001);
      return prev ?? z;
    });
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(Math.max(z + delta, 0.05), 5));
    }
  }, []);

  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.stopPropagation();
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const coords = toSvgCoords(e.clientX, e.clientY);
    dragRef.current = { id: layerId, startX: coords.x, startY: coords.y, origLeft: layer.left, origTop: layer.top };
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelectLayer(layerId);
  }, [layers, toSvgCoords, onSelectLayer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const coords = toSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - dragRef.current.startX;
    const dy = coords.y - dragRef.current.startY;
    onMoveLayer(dragRef.current.id, Math.round(dragRef.current.origLeft + dx), Math.round(dragRef.current.origTop + dy));
  }, [toSvgCoords, onMoveLayer]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-card/80 backdrop-blur border border-border rounded-md px-1 py-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground w-12 text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToScreen} title="適應畫面">
          <Maximize className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center bg-[hsl(220,14%,8%)] relative"
        onWheel={handleWheel}
      >
        {/* Checkerboard background */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        />
        <div className="p-4 flex-shrink-0" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            width={canvasWidth}
            height={canvasHeight}
            className="border border-border rounded"
            style={{ background: 'transparent', display: 'block' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <defs>
              <style>{css}</style>
            </defs>
            {renderLayers.map((layer) => (
              <g
                key={layer.id}
                onPointerDown={(e) => handlePointerDown(e, layer.id)}
                style={{ cursor: "grab" }}
              >
                <image
                  href={layer.imageDataUrl}
                  x={layer.left}
                  y={layer.top}
                  width={layer.width}
                  height={layer.height}
                  className={`layer-${layer.id}`}
                  style={{
                    transformOrigin: `${layer.left + layer.width / 2}px ${layer.top + layer.height / 2}px`,
                    transform: [
                      layer.flipH ? 'scaleX(-1)' : '',
                      layer.flipV ? 'scaleY(-1)' : '',
                    ].filter(Boolean).join(' ') || undefined,
                  }}
                />
                {selectedId === layer.id && (
                  <rect
                    x={layer.left - 1}
                    y={layer.top - 1}
                    width={layer.width + 2}
                    height={layer.height + 2}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    pointerEvents="none"
                  />
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
