"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Kept in sync with backend/app/api/v1/campaigns_execute.py's _CELL_PLACEHOLDER_RE.
// {{Cell:B3}} resolves against the campaign's configured sheet; {{Cell:Sheet!B3}}
// names its own sheet.
export const CELL_REF_RE = /\{\{Cell:(?:([^!{}]+)!)?([A-Za-z]{1,3}[0-9]+)\}\}/g;
const FULL_CELL_RE = /^[A-Za-z]{1,3}[0-9]+$/;

export interface CellLookupResult {
  found: boolean;
  value: string;
}

interface CellReferenceFieldProps {
  value: string;
  onChange: (value: string) => void;
  sheetNames: string[];
  defaultSheetName: string;
  getCellValue: (sheet: string, cellRef: string) => CellLookupResult;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}

/** Subject/Body field that turns "#" into a live sheet+cell picker for the
 * {{Cell:Sheet!Ref}} placeholder, and lists every reference already in the
 * text with its resolved value so it can be checked without the Preview step. */
export function CellReferenceField({
  value, onChange, sheetNames, defaultSheetName, getCellValue,
  multiline, rows = 8, placeholder, className,
}: CellReferenceFieldProps) {
  const ref = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const hasSheets = sheetNames.length > 0;
  const bangIdx = query.indexOf("!");
  const sheetMode = hasSheets && bangIdx === -1;
  const sheetQuery = sheetMode ? query : bangIdx === -1 ? "" : query.slice(0, bangIdx);
  const cellQuery = sheetMode ? "" : bangIdx === -1 ? query : query.slice(bangIdx + 1);

  const sheetSuggestions = useMemo(() => {
    if (!sheetMode) return [];
    const q = sheetQuery.trim().toLowerCase();
    const list = q ? sheetNames.filter((n) => n.toLowerCase().includes(q)) : sheetNames;
    return list.slice(0, 8);
  }, [sheetMode, sheetQuery, sheetNames]);

  const cellIsComplete = !sheetMode && FULL_CELL_RE.test(cellQuery.trim());
  const activeSheet = hasSheets ? sheetQuery.trim() : defaultSheetName;
  const cellPreview = cellIsComplete ? getCellValue(activeSheet, cellQuery.trim()) : null;

  const close = () => { setOpen(false); setTriggerStart(null); setQuery(""); setHighlight(0); };

  const recompute = (text: string, cursor: number) => {
    const upto = text.slice(0, cursor);
    const idx = upto.lastIndexOf("#");
    if (idx === -1) { close(); return; }
    const between = upto.slice(idx + 1);
    if (between.includes("\n") || between.includes("}}") || between.includes("#") || between.length > 60) {
      close();
      return;
    }
    setTriggerStart(idx);
    setQuery(between);
    setOpen(true);
    setHighlight(0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    recompute(next, e.target.selectionStart ?? next.length);
  };

  const placeCursor = (pos: number) => {
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  // Re-reads the live DOM value/cursor instead of trusting `query`/`triggerStart`
  // React state, which can lag a keystroke behind a fast type-then-Enter (state
  // updates from the last onChange may not have committed yet when the
  // following keydown fires) - that lag previously left trailing characters
  // behind after inserting a reference.
  const liveQueryInfo = () => {
    const text: string = ref.current?.value ?? value;
    const cursor: number = ref.current?.selectionStart ?? text.length;
    const upto = text.slice(0, cursor);
    const idx = upto.lastIndexOf("#");
    if (idx === -1) return null;
    return { start: idx, end: cursor, query: upto.slice(idx + 1) };
  };

  const chooseSheet = (sheet: string) => {
    const info = liveQueryInfo();
    if (!info) return;
    const inserted = `${sheet}!`;
    const next = value.slice(0, info.start + 1) + inserted + value.slice(info.end);
    onChange(next);
    setTriggerStart(info.start);
    setQuery(inserted);
    setHighlight(0);
    placeCursor(info.start + 1 + inserted.length);
  };

  const confirmCell = () => {
    const info = liveQueryInfo();
    if (!info) return;
    const bang = info.query.indexOf("!");
    const sheetPart = hasSheets ? (bang === -1 ? "" : info.query.slice(0, bang)) : "";
    const cellPart = (bang === -1 ? info.query : info.query.slice(bang + 1)).trim();
    if (!FULL_CELL_RE.test(cellPart)) return;
    const token = `{{Cell:${hasSheets ? `${sheetPart.trim()}!` : ""}${cellPart.toUpperCase()}}}`;
    const next = value.slice(0, info.start) + token + value.slice(info.end);
    onChange(next);
    const pos = info.start + token.length;
    close();
    placeCursor(pos);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!open) return;
    const info = liveQueryInfo();
    if (!info) { close(); return; }
    const freshSheetMode = hasSheets && info.query.indexOf("!") === -1;
    if (freshSheetMode) {
      const q = info.query.trim().toLowerCase();
      const list = (q ? sheetNames.filter((n) => n.toLowerCase().includes(q)) : sheetNames).slice(0, 8);
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, list.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
      else if ((e.key === "Enter" || e.key === "Tab") && list[highlight]) { e.preventDefault(); chooseSheet(list[highlight]); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    } else {
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); confirmCell(); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    }
  };

  const references = useMemo(() => {
    return Array.from(value.matchAll(CELL_REF_RE)).map((m, i) => ({
      key: `${m.index}-${i}`,
      sheet: (m[1] || defaultSheetName || "").trim(),
      cell: (m[2] || "").toUpperCase(),
    }));
  }, [value, defaultSheetName]);

  const Field = multiline ? "textarea" : "input";
  const fieldClasses = multiline
    ? "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
    : "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

  return (
    <div className="relative">
      <Field
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(close, 120)}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        className={cn(fieldClasses, className)}
      />

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {sheetMode ? (
            sheetSuggestions.length > 0 ? (
              sheetSuggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); chooseSheet(s); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 cursor-pointer",
                    i === highlight ? "bg-zinc-100 dark:bg-white/10" : "hover:bg-zinc-50 dark:hover:bg-white/5"
                  )}
                >
                  📄 {s}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-zinc-400">No matching sheet</div>
            )
          ) : (
            <button
              type="button"
              disabled={!cellIsComplete}
              onMouseDown={(e) => { e.preventDefault(); confirmCell(); }}
              className="w-full text-left px-3 py-2 text-xs disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer disabled:cursor-default"
            >
              <div className="font-mono dark:text-white">
                {`{{Cell:${hasSheets ? `${activeSheet}!` : ""}${cellQuery.trim().toUpperCase() || "…"}}}`}
              </div>
              {cellIsComplete ? (
                <div className={cn("mt-0.5", cellPreview?.found ? "text-emerald-600" : "text-amber-600")}>
                  {cellPreview?.found
                    ? `→ ${cellPreview.value || "(empty cell)"}`
                    : "⚠ sheet not found in uploaded file"}
                </div>
              ) : (
                <div className="mt-0.5 text-zinc-400">Type a cell address, e.g. B3</div>
              )}
            </button>
          )}
        </div>
      )}

      {references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {references.map((r) => {
            const lookup = getCellValue(r.sheet, r.cell);
            return (
              <span
                key={r.key}
                title={`Sheet: ${r.sheet} · Cell: ${r.cell} · Value: ${lookup.found ? (lookup.value || "(empty)") : "sheet not found"}`}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono border cursor-default",
                  lookup.found
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                    : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400"
                )}
              >
                {r.sheet}!{r.cell} → {lookup.found ? (lookup.value || "(empty)") : "not found"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
