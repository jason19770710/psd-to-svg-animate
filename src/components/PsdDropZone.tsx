import { useCallback, useState } from "react";
import { Upload, FileImage } from "lucide-react";

interface PsdDropZoneProps {
  onFileLoad: (buffer: ArrayBuffer, filename: string) => void;
  onSvgLoad?: (svgText: string, filename: string) => void;
}

export function PsdDropZone({ onFileLoad, onSvgLoad }: PsdDropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if (name.endsWith(".svg") && onSvgLoad) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") onSvgLoad(reader.result, file.name);
        };
        reader.readAsText(file);
        return;
      }
      if (!name.endsWith(".psd")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) onFileLoad(reader.result, file.name);
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoad, onSvgLoad]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".psd,.svg";
        input.onchange = (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) handleFile(f);
        };
        input.click();
      }}
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-all duration-200
        ${dragging ? "border-primary bg-primary/10 scale-[1.02]" : "border-border hover:border-muted-foreground hover:bg-surface-hover"}`}
    >
      <div className="rounded-full bg-secondary p-4">
        {dragging ? (
          <FileImage className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className="text-foreground font-medium">拖拽檔案到此處</p>
        <p className="text-sm text-muted-foreground mt-1">支援 .psd 及 .svg 檔案</p>
      </div>
    </div>
  );
}
