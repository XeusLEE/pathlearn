"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, FileText, Upload, X } from "lucide-react";

interface DropZoneProps {
  /** Currently selected file (lifted state). */
  file: File | null;
  /** Called when a valid file has been read into text. */
  onFile: (file: File, text: string) => void;
  /** Called when the user clears the selected file. */
  onClear: () => void;
}

const ACCEPT = ".txt,.md,text/plain,text/markdown";
const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB sanity cap

const isProbablyText = (file: File) => {
  if (file.type) {
    return (
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      file.type === "application/xml" ||
      file.type === ""
    );
  }
  // No mime type — fall back to extension.
  return /\.(txt|md|markdown|text)$/i.test(file.name);
};

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function DropZone({ file, onFile, onClear }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      setError(null);
      if (!files || files.length === 0) return;
      const f = files[0];

      if (!isProbablyText(f)) {
        setError("That doesn't look like a text file. Try a .txt or .md.");
        return;
      }
      if (f.size > MAX_BYTES) {
        setError("File is a bit chunky — please keep it under 1.5 MB.");
        return;
      }
      try {
        const text = await f.text();
        if (!text.trim()) {
          setError("That file looks empty.");
          return;
        }
        onFile(f, text);
      } catch {
        setError("Couldn't read that file. Try another?");
      }
    },
    [onFile]
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <AnimatePresence mode="wait" initial={false}>
        {!file ? (
          <motion.button
            key="zone"
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={[
              "w-full rounded-2xl border-2 border-dashed p-8 md:p-10",
              "flex flex-col items-center justify-center gap-3 text-center",
              "transition-colors",
              isOver
                ? "border-primary bg-primary-soft"
                : "border-border-soft bg-surface-muted hover:bg-primary-soft/40 hover:border-primary/60",
            ].join(" ")}
          >
            <div
              className={[
                "h-14 w-14 rounded-2xl flex items-center justify-center",
                isOver
                  ? "bg-primary text-white shadow-pop-primary"
                  : "bg-surface text-primary-dark shadow-pop-soft border-2 border-border-soft",
              ].join(" ")}
            >
              <Upload className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-extrabold text-ink text-lg">
                {isOver ? "Drop it here!" : "Drop a file or tap to browse"}
              </div>
              <div className="text-sm text-ink-muted font-semibold mt-1">
                Plain text or markdown · up to 1.5 MB
              </div>
            </div>
          </motion.button>
        ) : (
          <motion.div
            key="picked"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="card-pop flex items-center gap-3 p-4"
          >
            <div className="h-12 w-12 rounded-xl bg-primary-soft text-primary-dark flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-ink truncate">{file.name}</div>
              <div className="text-xs font-semibold text-ink-muted">
                {fmtSize(file.size)} · ready to go
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClear();
                if (inputRef.current) inputRef.current.value = "";
              }}
              aria-label="Remove file"
              className="tap-target rounded-full bg-surface-muted hover:bg-heart/15 text-ink-muted hover:text-heart transition-colors"
            >
              <X className="h-4 w-4" strokeWidth={3} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-2 text-sm font-semibold text-heart-dark bg-heart/10 border-2 border-heart/30 rounded-xl px-3 py-2 animate-shake"
        >
          <AlertCircle
            className="h-4 w-4 shrink-0 mt-0.5"
            strokeWidth={2.5}
            aria-hidden
          />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
}
