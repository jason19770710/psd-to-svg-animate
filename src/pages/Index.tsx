import { useState, useCallback, useEffect, useRef } from "react";
import { PsdDropZone } from "@/components/PsdDropZone";
import { LayerList } from "@/components/LayerList";
import { AnimationPanel } from "@/components/AnimationPanel";
import { SvgPreview } from "@/components/SvgPreview";
import { ExportDialog } from "@/components/ExportDialog";
import { parsePsdFile } from "@/lib/psd-parser";
import { exportSvg, exportHtml } from "@/lib/svg-export";
import { importSvg } from "@/lib/svg-import";
import { LayerInfo, AnimationConfig, defaultAnimationConfig } from "@/types/psd";
import { Download, FileImage, Loader2, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUndo } from "@/hooks/use-undo";

interface AppState {
  layers: LayerInfo[];
  animations: Record<string, AnimationConfig>;
  selectedId: string | null;
}

let imageCounter = 0;

function loadImageAsLayer(file: File): Promise<LayerInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        imageCounter++;
        resolve({
          id: `img-${Date.now()}-${imageCounter}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          left: 0,
          top: 0,
          width: img.width,
          height: img.height,
          imageDataUrl: dataUrl,
          visible: true,
        });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Index() {
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [animations, setAnimations] = useState<Record<string, AnimationConfig>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 2880, h: 1620 });
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [psdFilename, setPsdFilename] = useState("animated");
  const [exportOpen, setExportOpen] = useState(false);

  const { pushSnapshot, undo, redo, canUndo, canRedo, clear: clearHistory } = useUndo<AppState>();

  // Use refs so snapshot/undo/redo always read fresh state
  const stateRef = useRef<AppState>({ layers: [], animations: {}, selectedId: null });
  stateRef.current = { layers, animations, selectedId };

  const saveSnapshot = useCallback(() => {
    pushSnapshot(stateRef.current);
  }, [pushSnapshot]);

  const applyState = useCallback((s: AppState) => {
    setLayers(s.layers);
    setAnimations(s.animations);
    setSelectedId(s.selectedId);
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undo(stateRef.current);
    if (prev) applyState(prev);
  }, [undo, applyState]);

  const handleRedo = useCallback(() => {
    const next = redo(stateRef.current);
    if (next) applyState(next);
  }, [redo, applyState]);

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const handleFileLoad = useCallback(async (buffer: ArrayBuffer, filename: string) => {
    const baseName = filename.replace(/\.psd$/i, "");
    setPsdFilename(baseName);
    setLoading(true);
    try {
      const result = await parsePsdFile(buffer);
      setLayers(result.layers);
      const anims: Record<string, AnimationConfig> = {};
      result.layers.forEach((l) => {
        anims[l.id] = { ...defaultAnimationConfig };
      });
      setAnimations(anims);
      setSelectedId(result.layers[0]?.id ?? null);
      setLoaded(true);
      toast.success(`已載入 ${result.layers.length} 個圖層`);
    } catch (e) {
      console.error(e);
      toast.error("PSD 檔案解析失敗");
    }
    setLoading(false);
  }, []);


  const handleSvgLoad = useCallback((svgText: string, filename: string) => {
    try {
      const result = importSvg(svgText);
      setLayers(result.layers);
      setAnimations(result.animations);
      setCanvasSize(result.canvasSize);
      setSelectedId(result.layers[0]?.id ?? null);
      setPsdFilename(filename.replace(/\.svg$/i, ""));
      setLoaded(true);
      toast.success(`已從 SVG 載入 ${result.layers.length} 個圖層`);
    } catch {
      toast.error("SVG 檔案解析失敗");
    }
  }, []);

  const handleAddImage = useCallback(async (file: File) => {
    // Check if it's a PSD file
    if (file.name.toLowerCase().endsWith(".psd")) {
      const reader = new FileReader();
      reader.onload = async () => {
        if (reader.result instanceof ArrayBuffer) {
          try {
            const result = await parsePsdFile(reader.result);
            setLayers((prev) => [...result.layers, ...prev]);
            setAnimations((prev) => {
              const newAnims = { ...prev };
              result.layers.forEach((l) => {
                newAnims[l.id] = { ...defaultAnimationConfig };
              });
              return newAnims;
            });
            toast.success(`已加入 ${result.layers.length} 個圖層`);
          } catch {
            toast.error("PSD 檔案解析失敗");
          }
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    try {
      const layer = await loadImageAsLayer(file);
      setLayers((prev) => [layer, ...prev]);
      setAnimations((prev) => ({ ...prev, [layer.id]: { ...defaultAnimationConfig } }));
      setSelectedId(layer.id);
      toast.success(`已加入圖層: ${layer.name}`);
    } catch {
      toast.error(`無法載入圖片: ${file.name}`);
    }
  }, []);

  const saveFile = async (blob: Blob, suggestedName: string, description: string, accept: Record<string, string[]>) => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{ description, accept }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e: any) {
        if (e.name === 'AbortError') return false;
        // Fallback to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  };

  const handleExport = useCallback(async (filename: string, format: "svg" | "svg+html") => {

    const svg = exportSvg(layers, animations, canvasSize.w, canvasSize.h);
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const saved = await saveFile(svgBlob, `${filename}.svg`, "SVG 檔案", { "image/svg+xml": [".svg"] });
    if (!saved) return;

    if (format === "svg+html") {
      const html = exportHtml(layers, animations, canvasSize.w, canvasSize.h);
      const htmlBlob = new Blob([html], { type: "text/html" });
      await saveFile(htmlBlob, `${filename}.html`, "HTML 檔案", { "text/html": [".html"] });
    }

    toast.success(format === "svg+html" ? "SVG + HTML 已導出" : "SVG 已導出");
  }, [layers, animations, canvasSize]);

  const toggleVisibility = useCallback((id: string) => {
    saveSnapshot();
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }, [saveSnapshot]);

  const updateAnimation = useCallback((id: string, config: AnimationConfig) => {
    saveSnapshot();
    setAnimations((prev) => ({ ...prev, [id]: config }));
  }, [saveSnapshot]);

  const moveLayer = useCallback((id: string, left: number, top: number) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, left, top } : l)));
  }, []);

  const reorderLayers = useCallback((newLayers: LayerInfo[]) => {
    saveSnapshot();
    setLayers(newLayers);
  }, [saveSnapshot]);

  const duplicateLayer = useCallback((id: string) => {
    const source = layers.find((l) => l.id === id);
    if (!source) return;
    saveSnapshot();
    const newId = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const copy: LayerInfo = { ...source, id: newId, name: `${source.name} 副本` };
    const idx = layers.indexOf(source);
    const newLayers = [...layers];
    newLayers.splice(idx, 0, copy);
    setLayers(newLayers);
    setAnimations((prev) => ({ ...prev, [newId]: { ...(prev[id] || defaultAnimationConfig) } }));
    setSelectedId(newId);
    toast.success(`已複製圖層: ${source.name}`);
  }, [layers, saveSnapshot]);

  const toggleExportExclude = useCallback((id: string) => {
    saveSnapshot();
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, exportExcluded: !l.exportExcluded } : l)));
  }, [saveSnapshot]);

  const flipLayer = useCallback((id: string, axis: "h" | "v") => {
    saveSnapshot();
    setLayers((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      return axis === "h" ? { ...l, flipH: !l.flipH } : { ...l, flipV: !l.flipV };
    }));
  }, [saveSnapshot]);

  const deleteLayer = useCallback((id: string) => {
    saveSnapshot();
    setLayers((prev) => {
      const newLayers = prev.filter((l) => l.id !== id);
      if (selectedId === id) {
        setSelectedId(newLayers[0]?.id ?? null);
      }
      return newLayers;
    });
    setAnimations((prev) => {
      const newAnims = { ...prev };
      delete newAnims[id];
      return newAnims;
    });
    toast.success("已刪除圖層");
  }, [selectedId, saveSnapshot]);

  const replaceLayerImage = useCallback((id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        saveSnapshot();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        setLayers((prev) => prev.map((l) =>
          l.id === id ? { ...l, imageDataUrl: dataUrl, width: img.width, height: img.height } : l
        ));
        toast.success(`已替換圖層圖片`);
      };
      img.onerror = () => toast.error("無法載入圖片");
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, [saveSnapshot]);

  const selectedLayer = layers.find((l) => l.id === selectedId);

  const PRESETS = [
    { label: "桌機版頭 2880×1620", w: 2880, h: 1620 },
    { label: "手機版頭 1110×2405", w: 1110, h: 2405 },
    { label: "版身標題 939×150", w: 939, h: 150 },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
        <div className="flex items-center gap-3">
          <FileImage className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground font-mono">PSD 動態 SVG 產生器</h1>
        </div>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          上傳 PSD 檔案，為每個圖層設定動畫效果，然後導出為帶有內嵌 CSS 動畫的 SVG 檔案。
        </p>

        {/* Canvas size selection */}
        <div className="w-full max-w-lg space-y-3">
          <p className="text-sm font-medium text-foreground">舞台尺寸</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant={canvasSize.w === p.w && canvasSize.h === p.h ? "default" : "outline"}
                size="sm"
                className="text-xs font-mono whitespace-nowrap"
                onClick={() => setCanvasSize({ w: p.w, h: p.h })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">自訂</span>
            <input
              type="number"
              value={canvasSize.w}
              onChange={(e) => setCanvasSize((s) => ({ ...s, w: Math.max(1, Number(e.target.value) || 0) }))}
              className="w-20 h-8 px-2 text-xs font-mono text-foreground bg-background border border-border rounded text-center"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <input
              type="number"
              value={canvasSize.h}
              onChange={(e) => setCanvasSize((s) => ({ ...s, h: Math.max(1, Number(e.target.value) || 0) }))}
              className="w-20 h-8 px-2 text-xs font-mono text-foreground bg-background border border-border rounded text-center"
            />
          </div>
        </div>

        <div className="w-full max-w-lg">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">正在解析 PSD 檔案...</p>
            </div>
          ) : (
            <PsdDropZone onFileLoad={handleFileLoad} onSvgLoad={handleSvgLoad} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-primary" />
          <span className="font-mono text-sm font-semibold text-foreground">PSD → SVG</span>
          <div className="flex items-center gap-0.5 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo()}
              className="h-7 w-7 p-0"
              title="復原 (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo()}
              className="h-7 w-7 p-0"
              title="重做 (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span>舞台</span>
            <input
              type="number"
              value={canvasSize.w}
              onChange={(e) => setCanvasSize((s) => ({ ...s, w: Math.max(1, Number(e.target.value) || 0) }))}
              className="w-16 h-7 px-1.5 text-xs font-mono text-foreground bg-background border border-border rounded text-center"
            />
            <span>×</span>
            <input
              type="number"
              value={canvasSize.h}
              onChange={(e) => setCanvasSize((s) => ({ ...s, h: Math.max(1, Number(e.target.value) || 0) }))}
              className="w-16 h-7 px-1.5 text-xs font-mono text-foreground bg-background border border-border rounded text-center"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoaded(false);
              setLayers([]);
              setAnimations({});
              setSelectedId(null);
            }}
            className="text-xs font-mono"
          >
            重新載入
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)} className="text-xs font-mono gap-1.5">
            <Download className="h-3.5 w-3.5" />
            導出
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-border bg-card flex-shrink-0 overflow-hidden flex flex-col">
          <LayerList
            layers={layers}
            selectedId={selectedId}
            animations={animations}
            onSelect={setSelectedId}
            onToggleVisibility={toggleVisibility}
            onReorder={reorderLayers}
            onAddImage={handleAddImage}
            onDuplicateLayer={duplicateLayer}
            onToggleExportExclude={toggleExportExclude}
            onDeleteLayer={deleteLayer}
            onReplaceLayerImage={replaceLayerImage}
          />
        </div>

        <SvgPreview
          layers={layers}
          animations={animations}
          canvasWidth={canvasSize.w}
          canvasHeight={canvasSize.h}
          selectedId={selectedId}
          onSelectLayer={setSelectedId}
          onMoveLayer={moveLayer}
          onMoveStart={saveSnapshot}
        />

        <div className="w-72 border-l border-border bg-card flex-shrink-0 overflow-hidden flex flex-col">
          {selectedLayer && animations[selectedId!] ? (
            <AnimationPanel
              layerName={selectedLayer.name}
              config={animations[selectedId!]}
              onChange={(c) => updateAnimation(selectedId!, c)}
              flipH={!!selectedLayer.flipH}
              flipV={!!selectedLayer.flipV}
              onFlip={(axis) => flipLayer(selectedId!, axis)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground text-center">選擇一個圖層以設定動畫</p>
            </div>
          )}
        </div>
      </div>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaultFilename={psdFilename}
        onExport={handleExport}
      />
    </div>
  );
}
