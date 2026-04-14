import { Mouse, Download, Layers, Plus, Copy, Trash2, RotateCw, ZoomIn, Palette, Eye, Replace, HelpCircle, GripVertical, Ban, Undo2, Redo2, Move, Blend, FlipHorizontal, ChevronDown, Maximize } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface HelpItem {
  icon: React.ReactNode;
  text: string;
}

interface HelpSection {
  icon: React.ReactNode;
  title: string;
  items: HelpItem[];
}

const sections: HelpSection[] = [
  {
    icon: <Mouse className="h-3.5 w-3.5 text-primary" />,
    title: "舞台操作",
    items: [
      { icon: <Mouse className="h-3 w-3" />, text: "點擊圖層 → 選取並顯示邊框" },
      { icon: <Move className="h-3 w-3" />, text: "拖拽圖層 → 移動位置" },
      { icon: <ZoomIn className="h-3 w-3" />, text: "滾輪 → 縮放舞台" },
      { icon: <ZoomIn className="h-3 w-3" />, text: "+/− 按鈕 → 逐級放大/縮小" },
      { icon: <Maximize className="h-3 w-3" />, text: "適應畫面 → 自動縮放至最佳比例" },
    ],
  },
  {
    icon: <Layers className="h-3.5 w-3.5 text-primary" />,
    title: "圖層管理",
    items: [
      { icon: <GripVertical className="h-3 w-3" />, text: "拖拽排序 → 調整圖層順序" },
      { icon: <Eye className="h-3 w-3" />, text: "顯示/隱藏圖層" },
      { icon: <Plus className="h-3 w-3" />, text: "加入圖片或 PSD 為新圖層" },
      { icon: <Copy className="h-3 w-3" />, text: "複製圖層" },
      { icon: <Trash2 className="h-3 w-3" />, text: "刪除圖層" },
      { icon: <Replace className="h-3 w-3" />, text: "替換圖層圖片" },
      { icon: <Ban className="h-3 w-3" />, text: "排除導出（不含於 SVG）" },
    ],
  },
  {
    icon: <Undo2 className="h-3.5 w-3.5 text-primary" />,
    title: "復原 / 重做",
    items: [
      { icon: <Undo2 className="h-3 w-3" />, text: "Ctrl+Z → 復原上一步操作" },
      { icon: <Redo2 className="h-3 w-3" />, text: "Ctrl+Shift+Z → 重做" },
    ],
  },
  {
    icon: <RotateCw className="h-3.5 w-3.5 text-primary" />,
    title: "動畫設定（右側面板）",
    items: [
      { icon: <Move className="h-3 w-3" />, text: "移動：自由角度 + 距離" },
      { icon: <ZoomIn className="h-3 w-3" />, text: "縮放：放大/縮小比例" },
      { icon: <RotateCw className="h-3 w-3" />, text: "旋轉：單向持續 或 來回擺動" },
      { icon: <Blend className="h-3 w-3" />, text: "透明度：淡入淡出效果" },
      { icon: <Palette className="h-3 w-3" />, text: "色彩：色相/飽和度/亮度" },
      { icon: <FlipHorizontal className="h-3 w-3" />, text: "鏡射：水平/垂直翻轉" },
    ],
  },
  {
    icon: <Download className="h-3.5 w-3.5 text-primary" />,
    title: "導出",
    items: [
      { icon: <Download className="h-3 w-3" />, text: "SVG：帶內嵌 CSS 動畫" },
      { icon: <Download className="h-3 w-3" />, text: "SVG + HTML：含預覽頁面" },
      { icon: <Layers className="h-3 w-3" />, text: "SVG 可重新拖入編輯" },
    ],
  },
];

export function HelpGuide() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggle = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">操作說明</span>
      </div>
      <ScrollArea className="flex-1 px-3 pb-2">
        <div className="space-y-1">
          {sections.map((s) => (
            <Collapsible key={s.title} open={!!openSections[s.title]} onOpenChange={() => toggle(s.title)}>
              <CollapsibleTrigger className="flex items-center gap-1.5 w-full py-1 hover:bg-accent/50 rounded px-1 transition-colors">
                {s.icon}
                <span className="text-xs font-semibold text-foreground flex-1 text-left">{s.title}</span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${openSections[s.title] ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-0.5 pl-2 pb-1">
                  {s.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                      <span className="flex-shrink-0 text-muted-foreground/70">{item.icon}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
