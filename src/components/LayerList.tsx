import { useState, useRef, useCallback } from "react";
import { LayerInfo, AnimationConfig } from "@/types/psd";
import { Layers, Eye, EyeOff, GripVertical, Plus, Copy, Ban, Check, Trash2, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayerListProps {
  layers: LayerInfo[];
  selectedId: string | null;
  animations: Record<string, AnimationConfig>;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onReorder: (layers: LayerInfo[]) => void;
  onAddImage: (file: File) => void;
  onDuplicateLayer: (id: string) => void;
  onToggleExportExclude: (id: string) => void;
  onDeleteLayer?: (id: string) => void;
  onReplaceLayerImage?: (id: string, file: File) => void;
}

export function LayerList({ layers, selectedId, animations, onSelect, onToggleVisibility, onReorder, onAddImage, onDuplicateLayer, onToggleExportExclude, onDeleteLayer, onReplaceLayerImage, onFlipLayer }: LayerListProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  const hasAnimation = (id: string) => {
    const a = animations[id];
    if (!a) return false;
    return a.scale.enabled || a.bounce.enabled || a.move.enabled || a.rotate.enabled || a.fade?.enabled || a.colorShift?.enabled;
  };

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    dragNode.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    // Make drag image semi-transparent
    setTimeout(() => {
      if (dragNode.current) dragNode.current.style.opacity = "0.4";
    }, 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const newLayers = [...layers];
      const [moved] = newLayers.splice(dragIdx, 1);
      newLayers.splice(overIdx, 0, moved);
      onReorder(newLayers);
    }
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  }, [dragIdx, overIdx, layers, onReorder]);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const handleAddClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.psd,.ai,.svg,.webp,.gif,.bmp,.tiff,.tif";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach((f) => onAddImage(f));
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Layers className="h-4 w-4 text-primary" />
        <span className="font-mono text-sm font-medium text-foreground">圖層</span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{layers.length}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={handleAddClick} title="加入圖片">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, idx)}
            onClick={() => onSelect(layer.id)}
            className={`flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors group
              ${selectedId === layer.id ? "bg-primary/15 border border-primary/30" : "hover:bg-surface-hover border border-transparent"}
              ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "border-t-2 border-t-primary" : ""}`}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
            <div className="w-8 h-8 rounded bg-secondary flex-shrink-0 overflow-hidden border border-border">
              <img src={layer.imageDataUrl} alt={layer.name} className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${layer.exportExcluded ? "text-muted-foreground line-through" : "text-foreground"}`}>{layer.name}</p>
              {hasAnimation(layer.id) && (
                <p className="text-[10px] text-primary font-mono">● 動畫已設定</p>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onReplaceLayerImage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*,.svg,.webp,.gif,.bmp,.tiff,.tif";
                    input.onchange = (ev) => {
                      const f = (ev.target as HTMLInputElement).files?.[0];
                      if (f) onReplaceLayerImage(layer.id, f);
                    };
                    input.click();
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  title="替換圖片"
                >
                  <Replace className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicateLayer(layer.id); }}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="複製圖層"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {onFlipLayer && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFlipLayer(layer.id, "h"); }}
                    className={`p-0.5 ${layer.flipH ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="水平鏡射"
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFlipLayer(layer.id, "v"); }}
                    className={`p-0.5 ${layer.flipV ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    title="垂直鏡射"
                  >
                    <FlipVertical2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExportExclude(layer.id); }}
                className={`p-0.5 ${layer.exportExcluded ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                title={layer.exportExcluded ? "取消排除導出" : "排除導出"}
              >
                {layer.exportExcluded ? <Ban className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              {onDeleteLayer && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                  title="刪除圖層"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                className="text-muted-foreground hover:text-foreground p-0.5"
              >
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
