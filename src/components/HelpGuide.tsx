import { Keyboard, Mouse, Move, Undo2, Download, Layers, Plus, Copy, Trash2, RotateCw, ArrowUpDown, ZoomIn, Palette, Eye, Replace, FlipHorizontal, HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpSection {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const sections: HelpSection[] = [
  {
    icon: <Mouse className="h-3.5 w-3.5 text-primary" />,
    title: "舞台操作",
    items: [
      "點擊圖層 → 選取並顯示邊框",
      "拖拽圖層 → 移動位置",
    ],
  },
  {
    icon: <Layers className="h-3.5 w-3.5 text-primary" />,
    title: "圖層管理",
    items: [
      "拖拽排序 → 調整圖層順序",
      "👁 顯示/隱藏圖層",
      "＋ 加入圖片或 PSD 為新圖層",
      "複製 / 刪除 / 替換圖片",
      "⊘ 排除導出（不含於 SVG）",
    ],
  },
  {
    icon: <RotateCw className="h-3.5 w-3.5 text-primary" />,
    title: "動畫設定（右側面板）",
    items: [
      "移動：自由角度 + 距離",
      "縮放：放大/縮小比例",
      "旋轉：單向持續 或 來回擺動",
      "透明度：淡入淡出效果",
      "色彩：色相/飽和度/亮度",
      "鏡射：水平/垂直翻轉",
      "各動畫可同時疊加使用",
    ],
  },
  {
    icon: <Keyboard className="h-3.5 w-3.5 text-primary" />,
    title: "快捷鍵",
    items: [
      "Ctrl+Z → 復原",
      "Ctrl+Shift+Z → 重做",
    ],
  },
  {
    icon: <Download className="h-3.5 w-3.5 text-primary" />,
    title: "導出",
    items: [
      "SVG：帶內嵌 CSS 動畫",
      "SVG + HTML：含預覽頁面",
      "SVG 可重新拖入編輯",
    ],
  },
];

export function HelpGuide() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">操作說明</span>
      </div>
      <ScrollArea className="flex-1 px-3 pb-2">
        <div className="space-y-2.5">
          {sections.map((s) => (
            <div key={s.title}>
              <div className="flex items-center gap-1.5 mb-1">
                {s.icon}
                <span className="text-xs font-semibold text-foreground">{s.title}</span>
              </div>
              <ul className="space-y-0.5 pl-5">
                {s.items.map((item, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
