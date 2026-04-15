import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { LayerInfo, AnimationConfig } from "@/types/psd";
import { generateAnimationCSS, buildLayerSvgElements } from "@/lib/svg-export";
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
  onMoveStart?: () => void;
  animKey?: number;
  onMoveBPoint?: (id: string, targetX: number, targetY: number) => void;
  onMoveAPoint?: (id: string, startX: number, startY: number) => void;
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function SvgPreview({ layers, animations, canvasWidth, canvasHeight, selectedId, onSelectLayer, onMoveLayer, onMoveStart, animKey, onMoveBPoint, onMoveAPoint }: SvgPreviewProps) {
  const css = useMemo(() => generateAnimationCSS(layers, animations), [layers, animations, animKey]);
  const visibleLayers = layers.filter((l) => l.visible);
  const renderLayers = [...visibleLayers].reverse();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origLeft: number; origTop: number } | null>(null);
  const markerDragRef = useRef<{ id: string; point: "A" | "B"; startX: number; startY: number; origTX: number; origTY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const startPan = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;

    panRef.current = {
      startX: clientX,
      startY: clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsPanning(true);
  }, []);

  const handlePanStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    e.preventDefault();
    e.stopPropagation();
    startPan(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }, [startPan]);

  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!panRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    el.scrollLeft = panRef.current.scrollLeft - (clientX - panRef.current.startX);
    el.scrollTop = panRef.current.scrollTop - (clientY - panRef.current.startY);
  }, []);

  const handlePanEnd = useCallback(() => {
    panRef.current = null;
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (!isPanning) return;

    const onPointerMove = (e: PointerEvent) => handlePanMove(e.clientX, e.clientY);
    const onPointerEnd = () => handlePanEnd();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [isPanning, handlePanMove, handlePanEnd]);

  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const padded = 32;
    const scaleX = (el.clientWidth - padded) / canvasWidth;
    const scaleY = (el.clientHeight - padded) / canvasHeight;
    setZoom(Math.min(scaleX, scaleY, 1));
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0) {
      requestAnimationFrame(() => fitToScreen());
    }
  }, [canvasWidth, canvasHeight, fitToScreen]);

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
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.05), 5));
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

  const isCanvasBackgroundLayer = useCallback((layer: LayerInfo) => {
    return layer.left <= 0 && layer.top <= 0 && layer.left + layer.width >= canvasWidth && layer.top + layer.height >= canvasHeight;
  }, [canvasWidth, canvasHeight]);

  const shouldStartPanInSvg = useCallback((clientX: number, clientY: number) => {
    if (spaceHeld) return true;

    const { x, y } = toSvgCoords(clientX, clientY);

    for (let i = renderLayers.length - 1; i >= 0; i--) {
      const layer = renderLayers[i];
      const hit = x >= layer.left && x <= layer.left + layer.width && y >= layer.top && y <= layer.top + layer.height;

      if (hit) {
        return isCanvasBackgroundLayer(layer);
      }
    }

    return true;
  }, [spaceHeld, toSvgCoords, renderLayers, isCanvasBackgroundLayer]);

  const handlePointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    if (spaceHeld || isPanning) return;
    e.stopPropagation();
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    onMoveStart?.();
    const coords = toSvgCoords(e.clientX, e.clientY);
    dragRef.current = { id: layerId, startX: coords.x, startY: coords.y, origLeft: layer.left, origTop: layer.top };
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelectLayer(layerId);
  }, [layers, toSvgCoords, onSelectLayer, onMoveStart, spaceHeld, isPanning]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (markerDragRef.current) {
      const coords = toSvgCoords(e.clientX, e.clientY);
      const dx = coords.x - markerDragRef.current.startX;
      const dy = coords.y - markerDragRef.current.startY;
      const newX = Math.round(markerDragRef.current.origTX + dx);
      const newY = Math.round(markerDragRef.current.origTY + dy);
      if (markerDragRef.current.point === "B") {
        onMoveBPoint?.(markerDragRef.current.id, newX, newY);
      } else {
        onMoveAPoint?.(markerDragRef.current.id, newX, newY);
      }
      return;
    }
    if (!dragRef.current) return;
    const coords = toSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - dragRef.current.startX;
    const dy = coords.y - dragRef.current.startY;
    onMoveLayer(dragRef.current.id, Math.round(dragRef.current.origLeft + dx), Math.round(dragRef.current.origTop + dy));
  }, [toSvgCoords, onMoveLayer, onMoveBPoint, onMoveAPoint]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    markerDragRef.current = null;
  }, []);

  const handleMarkerPointerDown = useCallback((e: React.PointerEvent, layerId: string, point: "A" | "B", currentX: number, currentY: number) => {
    if (spaceHeld || isPanning) return;
    e.stopPropagation();
    const coords = toSvgCoords(e.clientX, e.clientY);
    markerDragRef.current = { id: layerId, point, startX: coords.x, startY: coords.y, origTX: currentX, origTY: currentY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [toSvgCoords, spaceHeld, isPanning]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
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
        className="flex-1 overflow-auto bg-[hsl(220,14%,8%)] relative"
        style={{ cursor: isPanning ? "grabbing" : spaceHeld ? "grab" : undefined }}
        onWheel={handleWheel}
        onPointerDown={handlePanStart}
      >
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #fff 25%, transparent 25%), linear-gradient(-45deg, #fff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #fff 75%), linear-gradient(-45deg, transparent 75%, #fff 75%)`,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />
        <div
          style={{
            minWidth: "100%",
            minHeight: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            width: canvasWidth * zoom + 32 > (containerRef.current?.clientWidth ?? 0) ? canvasWidth * zoom + 32 : "100%",
            height: canvasHeight * zoom + 32 > (containerRef.current?.clientHeight ?? 0) ? canvasHeight * zoom + 32 : "100%",
          }}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center", flexShrink: 0 }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              width={canvasWidth}
              height={canvasHeight}
              className="border border-border rounded"
              style={{ background: "transparent", display: "block", cursor: isPanning ? "grabbing" : spaceHeld ? "grab" : "default" }}
              onPointerDownCapture={(e) => {
                if (shouldStartPanInSvg(e.clientX, e.clientY)) {
                  handlePanStart(e);
                }
              }}
              onPointerMove={(e) => {
                if (!panRef.current) {
                  handlePointerMove(e);
                }
              }}
              onPointerUp={handlePointerUp}
            >
              <defs>
                <style key={animKey}>{css}</style>
              </defs>
              {renderLayers.map((layer) => {
                const anim = animations[layer.id];
                const { wrapperClasses, imageClass } = buildLayerSvgElements(layer, anim);
                const origin = `${layer.left + layer.width / 2}px ${layer.top + layer.height / 2}px`;

                let content = (
                  <>
                    <image
                      href={layer.imageDataUrl}
                      x={layer.left}
                      y={layer.top}
                      width={layer.width}
                      height={layer.height}
                      className={imageClass || undefined}
                      style={{ transformOrigin: origin }}
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
                  </>
                );

                for (let i = wrapperClasses.length - 1; i >= 0; i--) {
                  content = <g className={wrapperClasses[i]} style={{ transformOrigin: origin }}>{content}</g>;
                }

                return (
                  <g
                    key={`${layer.id}-${animKey || 0}`}
                    onPointerDown={(e) => handlePointerDown(e, layer.id)}
                    style={{ cursor: "grab" }}
                  >
                    {content}
                  </g>
                );
              })}
              {/* A/B point markers for linear movement */}
              {(() => {
                if (!selectedId) return null;
                const selLayer = layers.find(l => l.id === selectedId);
                const selAnim = selectedId ? animations[selectedId] : undefined;
                if (!selLayer || !selAnim?.movement?.enabled || selAnim.movement.mode !== "linear") return null;
                const sx = selAnim.movement.startX ?? 0;
                const sy = selAnim.movement.startY ?? 0;
                const tx = selAnim.movement.targetX ?? 0;
                const ty = selAnim.movement.targetY ?? 0;
                const cx = selLayer.left + selLayer.width / 2;
                const cy = selLayer.top + selLayer.height / 2;
                const aX = cx + sx;
                const aY = cy + sy;
                const bX = cx + tx;
                const bY = cy + ty;
                const markerSize = 8;
                return (
                  <g onPointerDownCapture={(e) => e.stopPropagation()}>
                    {/* Line from A to B */}
                    <line x1={aX} y1={aY} x2={bX} y2={bY} stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" opacity={0.6} />
                    {/* A marker (draggable) */}
                    <circle cx={aX} cy={aY} r={markerSize} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={1.5} style={{ cursor: "grab" }}
                      onPointerDown={(e) => handleMarkerPointerDown(e, selectedId!, "A", sx, sy)} />
                    <text x={aX} y={aY + 1} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold" fill="hsl(var(--primary))" pointerEvents="none">A</text>
                    {/* B marker (draggable) */}
                    <circle cx={bX} cy={bY} r={markerSize} fill="hsl(var(--destructive) / 0.2)" stroke="hsl(var(--destructive))" strokeWidth={1.5} style={{ cursor: "grab" }}
                      onPointerDown={(e) => handleMarkerPointerDown(e, selectedId!, "B", tx, ty)} />
                    <text x={bX} y={bY + 1} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold" fill="hsl(var(--destructive))" pointerEvents="none">B</text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
