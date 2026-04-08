import { AnimationConfig } from "@/types/psd";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings2, ZoomIn, ArrowUpDown, MoveHorizontal, RotateCw, Eye, Palette, FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnimationPanelProps {
  layerName: string;
  config: AnimationConfig;
  onChange: (config: AnimationConfig) => void;
  flipH: boolean;
  flipV: boolean;
  onFlip: (axis: "h" | "v") => void;
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

export function AnimationPanel({ layerName, config, onChange, flipH, flipV, onFlip }: AnimationPanelProps) {
  const update = (partial: Partial<AnimationConfig>) => onChange({ ...config, ...partial });

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
          <Button
            variant={flipH ? "default" : "outline"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onFlip("h")}
            title="水平鏡射"
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={flipV ? "default" : "outline"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onFlip("v")}
            title="垂直鏡射"
          >
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

        {/* Bounce */}
        <Section icon={ArrowUpDown} title="跳動 Bounce" enabled={config.bounce.enabled}
          onToggle={(v) => update({ bounce: { ...config.bounce, enabled: v } })}>
          <SliderRow label="距離" value={config.bounce.distance} min={1} max={100} step={1} unit="px"
            onChange={(v) => update({ bounce: { ...config.bounce, distance: v } })} />
          <SliderRow label="速度" value={config.bounce.speed} min={0.1} max={5} step={0.1} unit="s"
            onChange={(v) => update({ bounce: { ...config.bounce, speed: v } })} />
          <LoopToggle loop={config.bounce.loop} onChange={(v) => update({ bounce: { ...config.bounce, loop: v } })} />
        </Section>

        {/* Move */}
        <Section icon={MoveHorizontal} title="移動 Move" enabled={config.move.enabled}
          onToggle={(v) => update({ move: { ...config.move, enabled: v } })}>
          <SliderRow label="距離" value={config.move.distance} min={1} max={200} step={1} unit="px"
            onChange={(v) => update({ move: { ...config.move, distance: v } })} />
          <SliderRow label="速度" value={config.move.speed} min={0.1} max={5} step={0.1} unit="s"
            onChange={(v) => update({ move: { ...config.move, speed: v } })} />
          <LoopToggle loop={config.move.loop} onChange={(v) => update({ move: { ...config.move, loop: v } })} />
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
            <button
              onClick={() => update({ rotate: { ...config.rotate, clockwise: !config.rotate.clockwise } })}
              className="text-xs font-mono text-primary hover:underline"
            >
              {config.rotate.clockwise ? "順時針 →" : "逆時針 ←"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">模式</Label>
            <button
              onClick={() => update({ rotate: { ...config.rotate, mode: config.rotate.mode === "continuous" ? "alternate" : "continuous" } })}
              className="text-xs font-mono text-primary hover:underline"
            >
              {config.rotate.mode === "continuous" ? "持續360同方向轉 ↻" : "來回旋轉 ⇄"}
            </button>
          </div>
        </Section>

        {/* Fade (Opacity) */}
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
