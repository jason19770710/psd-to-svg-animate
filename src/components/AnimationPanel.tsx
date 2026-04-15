import { useState, useEffect } from "react";
import { AnimationConfig } from "@/types/psd";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings2, ZoomIn, Move, RotateCw, Eye, Palette, FlipHorizontal2, FlipVertical2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnimationPanelProps {
  layerName: string;
  layerWidth: number;
  layerHeight: number;
  config: AnimationConfig;
  onChange: (config: AnimationConfig) => void;
  flipH: boolean;
  flipV: boolean;
  onFlip: (axis: "h" | "v") => void;
  onPlayLinear?: () => void;
  onResetLinear?: () => void;
}

function Section({
  icon: Icon,
  title,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${enabled ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="space-y-3 pt-1">{children}</div>}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-primary">{value}{unit}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function LoopToggle({ loop, onChange }: { loop: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">循環</Label>
      <Switch checked={loop} onCheckedChange={onChange} />
    </div>
  );
}

/** Visual compass for direction angle */
function AngleSelector({ angle, onChange }: { angle: number; onChange: (v: number) => void }) {
  const size = 80;
  const center = size / 2;
  const radius = 32;
  const rad = (angle * Math.PI) / 180;
  const dotX = center + Math.sin(rad) * radius;
  const dotY = center - Math.cos(rad) * radius;

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const update = (ev: MouseEvent | React.MouseEvent) => {
      const rect = (e.target as Element).closest("svg")!.getBoundingClientRect();
      const x = ev.clientX - rect.left - center;
      const y = ev.clientY - rect.top - center;
      let deg = Math.round((Math.atan2(x, -y) * 180) / Math.PI);
      if (deg < 0) deg += 360;
      onChange(deg);
    };
    update(e);
    const onMove = (ev: MouseEvent) => update(ev);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        className="cursor-pointer flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <circle cx={center} cy={center} r={radius + 4} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />
        <circle cx={center} cy={center} r={2} fill="hsl(var(--muted-foreground))" />
        {/* Cardinal markers */}
        {[0, 90, 180, 270].map((d) => {
          const r2 = radius + 2;
          const mx = center + Math.sin((d * Math.PI) / 180) * r2;
          const my = center - Math.cos((d * Math.PI) / 180) * r2;
          return <circle key={d} cx={mx} cy={my} r={1.5} fill="hsl(var(--muted-foreground) / 0.4)" />;
        })}
        {/* Direction line */}
        <line x1={center} y1={center} x2={dotX} y2={dotY} stroke="hsl(var(--primary))" strokeWidth={2} strokeLinecap="round" />
        <circle cx={dotX} cy={dotY} r={5} fill="hsl(var(--primary))" />
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-mono text-primary">{angle}°</span>
        <div className="grid grid-cols-3 gap-0.5">
          {[
            { label: "↖", deg: 315 }, { label: "↑", deg: 0 }, { label: "↗", deg: 45 },
            { label: "←", deg: 270 }, { label: "·", deg: -1 }, { label: "→", deg: 90 },
            { label: "↙", deg: 225 }, { label: "↓", deg: 180 }, { label: "↘", deg: 135 },
          ].map((btn) => (
            btn.deg === -1 ? <div key="c" /> :
            <button
              key={btn.deg}
              onClick={() => onChange(btn.deg)}
              className={`w-6 h-6 text-xs rounded transition-colors ${
                angle === btn.deg
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnimationPanel({ layerName, layerWidth, layerHeight, config, onChange, flipH, flipV, onFlip, onPlayLinear, onResetLinear }: AnimationPanelProps) {
  const update = (partial: Partial<AnimationConfig>) => onChange({ ...config, ...partial });
  const [isLinearPlaying, setIsLinearPlaying] = useState(false);

  // Reset playing state when mode changes or movement is disabled
  useEffect(() => {
    if (!config.movement.enabled || config.movement.mode !== "linear") {
      setIsLinearPlaying(false);
    }
  }, [config.movement.enabled, config.movement.mode]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Settings2 className="h-4 w-4 text-primary" />
        <span className="font-mono text-sm font-medium text-foreground">動畫設定</span>
      </div>
      <div className="px-4 py-2 border-b border-border space-y-2">
        <div>
          <p className="text-xs text-muted-foreground">圖層</p>
          <p className="text-sm text-foreground font-medium truncate">{layerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">鏡射</span>
          <Button variant={flipH ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => onFlip("h")} title="水平鏡射">
            <FlipHorizontal2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant={flipV ? "default" : "outline"} size="sm" className="h-7 w-7 p-0" onClick={() => onFlip("v")} title="垂直鏡射">
            <FlipVertical2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {/* Scale */}
        <Section icon={ZoomIn} title="縮放 Scale" enabled={config.scale.enabled}
          onToggle={(v) => update({ scale: { ...config.scale, enabled: v } })}>
          <SliderRow label="比例" value={config.scale.value} min={0.5} max={2} step={0.1} unit="x"
            onChange={(v) => update({ scale: { ...config.scale, value: v } })} />
          <SliderRow label="速度" value={config.scale.speed} min={0.1} max={5} step={0.1} unit="s"
            onChange={(v) => update({ scale: { ...config.scale, speed: v } })} />
          <LoopToggle loop={config.scale.loop} onChange={(v) => update({ scale: { ...config.scale, loop: v } })} />
        </Section>

        {/* Movement */}
        <Section icon={Move} title="移動 Movement" enabled={config.movement.enabled}
          onToggle={(v) => update({ movement: { ...config.movement, enabled: v } })}>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">模式</Label>
            <button onClick={() => {
              const newMode = config.movement.mode === "oscillate" ? "linear" : "oscillate";
              const updates: any = { movement: { ...config.movement, mode: newMode } };
              if (newMode === "linear" && (config.movement.targetX ?? 0) === 0 && (config.movement.targetY ?? 0) === 0) {
                updates.movement.targetX = -(layerWidth + 20);
              }
              update(updates);
            }} className="text-xs font-mono text-primary hover:underline">
              {config.movement.mode === "oscillate" ? "來回移動 ⇄" : "單次移動 B→A"}
            </button>
          </div>
          {config.movement.mode === "linear" ? (
            <>
              <div className="rounded-md bg-muted/50 p-2.5 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  A 點（終點，預設位置）：
                  <span className="font-mono text-destructive"> (0, 0)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  B 點（起點，可拖曳）：
                  <span className="font-mono text-primary"> ({config.movement.targetX ?? 0}, {config.movement.targetY ?? 0})</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">在畫布上拖曳藍色 B 標記來設定起點位置</p>
              </div>
              <SliderRow label="速度" value={config.movement.speed} min={0.1} max={5} step={0.1} unit="s"
                onChange={(v) => update({ movement: { ...config.movement, speed: v } })} />
              {!isLinearPlaying ? (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => {
                  onPlayLinear?.();
                  setIsLinearPlaying(true);
                }}>
                  <Play className="h-3.5 w-3.5" />
                  <span className="text-xs">播放移動效果</span>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => {
                  onResetLinear?.();
                  setIsLinearPlaying(false);
                }}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="text-xs">回復原位</span>
                </Button>
              )}
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">方向</Label>
                <AngleSelector
                  angle={config.movement.angle}
                  onChange={(v) => update({ movement: { ...config.movement, angle: v } })}
                />
              </div>
              <SliderRow label="距離" value={config.movement.distance} min={1} max={200} step={1} unit="px"
                onChange={(v) => update({ movement: { ...config.movement, distance: v } })} />
              <SliderRow label="速度" value={config.movement.speed} min={0.1} max={5} step={0.1} unit="s"
                onChange={(v) => update({ movement: { ...config.movement, speed: v } })} />
              <LoopToggle loop={config.movement.loop} onChange={(v) => update({ movement: { ...config.movement, loop: v } })} />
            </>
          )}
        </Section>

        {/* Rotate */}
        <Section icon={RotateCw} title="旋轉 Rotate" enabled={config.rotate.enabled}
          onToggle={(v) => update({ rotate: { ...config.rotate, enabled: v } })}>
          <SliderRow label="角度" value={config.rotate.angle} min={1} max={360} step={1} unit="°"
            onChange={(v) => update({ rotate: { ...config.rotate, angle: v } })} />
          <SliderRow label="速度" value={config.rotate.speed} min={0.1} max={10} step={0.1} unit="s"
            onChange={(v) => update({ rotate: { ...config.rotate, speed: v } })} />
          <LoopToggle loop={config.rotate.loop} onChange={(v) => update({ rotate: { ...config.rotate, loop: v } })} />
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">方向</Label>
            <button onClick={() => update({ rotate: { ...config.rotate, clockwise: !config.rotate.clockwise } })} className="text-xs font-mono text-primary hover:underline">
              {config.rotate.clockwise ? "順時針 →" : "逆時針 ←"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">模式</Label>
            <button onClick={() => update({ rotate: { ...config.rotate, mode: config.rotate.mode === "continuous" ? "alternate" : "continuous" } })} className="text-xs font-mono text-primary hover:underline">
              {config.rotate.mode === "continuous" ? "持續同方向轉 ↻" : "來回旋轉 ⇄"}
            </button>
          </div>
        </Section>

        {/* Fade */}
        <Section icon={Eye} title="透明度 Fade" enabled={config.fade.enabled}
          onToggle={(v) => update({ fade: { ...config.fade, enabled: v } })}>
          <SliderRow label="起始透明度" value={config.fade.fromOpacity} min={0} max={1} step={0.05} unit=""
            onChange={(v) => update({ fade: { ...config.fade, fromOpacity: v } })} />
          <SliderRow label="結束透明度" value={config.fade.toOpacity} min={0} max={1} step={0.05} unit=""
            onChange={(v) => update({ fade: { ...config.fade, toOpacity: v } })} />
          <SliderRow label="速度" value={config.fade.speed} min={0.1} max={5} step={0.1} unit="s"
            onChange={(v) => update({ fade: { ...config.fade, speed: v } })} />
          <LoopToggle loop={config.fade.loop} onChange={(v) => update({ fade: { ...config.fade, loop: v } })} />
        </Section>

        {/* Color Shift */}
        <Section icon={Palette} title="顏色 Color" enabled={config.colorShift.enabled}
          onToggle={(v) => update({ colorShift: { ...config.colorShift, enabled: v } })}>
          <SliderRow label="色相旋轉" value={config.colorShift.hueRotate} min={0} max={360} step={1} unit="°"
            onChange={(v) => update({ colorShift: { ...config.colorShift, hueRotate: v } })} />
          <SliderRow label="飽和度" value={config.colorShift.saturate} min={0} max={3} step={0.1} unit="x"
            onChange={(v) => update({ colorShift: { ...config.colorShift, saturate: v } })} />
          <SliderRow label="亮度" value={config.colorShift.brightness} min={0} max={3} step={0.1} unit="x"
            onChange={(v) => update({ colorShift: { ...config.colorShift, brightness: v } })} />
          <SliderRow label="速度" value={config.colorShift.speed} min={0.1} max={5} step={0.1} unit="s"
            onChange={(v) => update({ colorShift: { ...config.colorShift, speed: v } })} />
          <LoopToggle loop={config.colorShift.loop} onChange={(v) => update({ colorShift: { ...config.colorShift, loop: v } })} />
        </Section>
      </div>
    </div>
  );
}
