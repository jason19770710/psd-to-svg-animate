import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFilename: string;
  onExport: (filename: string, format: "svg" | "svg+html") => void;
}

export function ExportDialog({ open, onOpenChange, defaultFilename, onExport }: ExportDialogProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const [format, setFormat] = useState<"svg" | "svg+html">("svg");

  // Sync default filename when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setFilename(defaultFilename);
    onOpenChange(v);
  };

  const handleExport = () => {
    const name = filename.trim() || "animated";
    onExport(name, format);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">導出設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm">檔案名稱</Label>
            <div className="flex items-center gap-2">
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="animated"
                className="font-mono text-sm"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.svg</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">輸出格式</Label>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "svg" as const, label: "僅 SVG" },
                { key: "svg+html" as const, label: "SVG + HTML" },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFormat(opt.key)}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    format === opt.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs font-mono">
            取消
          </Button>
          <Button onClick={handleExport} className="text-xs font-mono gap-1.5">
            <Download className="h-3.5 w-3.5" />
            導出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
