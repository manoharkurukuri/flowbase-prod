"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Download,
  Edit3,
  Loader2,
  MoreHorizontal,
  Palette,
  PenLine,
  Plus,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  createWhiteboard,
  deleteWhiteboard,
  renameWhiteboard,
  updateWhiteboardColor,
  updateWhiteboardScene,
} from "@/lib/actions/whiteboard";
import {
  STICKY_NOTE_COLORS,
  WHITEBOARD_COLORS,
  getWhiteboardColorMeta,
  type StickyNoteColor,
  type WhiteboardColor,
  type WhiteboardRecord,
  type WhiteboardScene,
} from "@/lib/whiteboard";
import { cn } from "@/lib/utils";
import type {
  DiagramElementSkeleton,
  WhiteboardCanvasHandle,
} from "./whiteboard-canvas";

type WhiteboardPageClientProps = {
  initialWhiteboards: WhiteboardRecord[];
};

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

type AiDiagramResponse = {
  elements?: DiagramElementSkeleton[];
  message?: string;
  error?: string;
};

const WhiteboardCanvas = dynamic(
  () => import("./whiteboard-canvas").then((mod) => mod.WhiteboardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center bg-white text-[12px] font-semibold text-slate-400">
        <Loader2 size={16} className="mr-2 animate-spin text-violet-400" />
        Loading canvas
      </div>
    ),
  }
);

const diagramExamples = [
  "Flowchart for onboarding a new customer",
  "Mind map for a product launch",
  "System architecture for an AI notes app",
  "User journey for booking a demo",
];

const drawingColors = ["#1E293B", "#7C3AED", "#2563EB", "#0891B2", "#059669", "#EA580C", "#E11D48"];
const fillColors = ["transparent", "#FFFFFF", "#F5F3FF", "#EFF6FF", "#ECFEFF", "#ECFDF5", "#FFF7ED", "#FDF2F8"];

function sortWhiteboards(boards: WhiteboardRecord[]) {
  return [...boards].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getNextBoardName(count: number) {
  return count === 0 ? "Product whiteboard" : `Whiteboard ${count + 1}`;
}

export function WhiteboardPageClient({ initialWhiteboards }: WhiteboardPageClientProps) {
  const [whiteboards, setWhiteboards] = useState(() => sortWhiteboards(initialWhiteboards));
  const [selectedWhiteboardId, setSelectedWhiteboardId] = useState<number | null>(
    initialWhiteboards[0]?.id ?? null
  );
  const [canvasHandle, setCanvasHandle] = useState<WhiteboardCanvasHandle | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [stickyColor, setStickyColor] = useState<StickyNoteColor>(STICKY_NOTE_COLORS[0].value);
  const [strokeColor, setStrokeColor] = useState("#1E293B");
  const [backgroundColor, setBackgroundColor] = useState("transparent");
  const [textColor, setTextColor] = useState("#1E293B");
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const saveTimerRef = useRef<number | null>(null);
  const pendingSceneRef = useRef<{ boardId: number; scene: WhiteboardScene } | null>(null);

  const selectedWhiteboard = useMemo(
    () => whiteboards.find((board) => board.id === selectedWhiteboardId) ?? null,
    [selectedWhiteboardId, whiteboards]
  );

  const flushPendingScene = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pendingScene = pendingSceneRef.current;
    if (!pendingScene) return;

    pendingSceneRef.current = null;
    setSaveStatus("saving");

    startTransition(async () => {
      try {
        const updated = await updateWhiteboardScene(pendingScene.boardId, pendingScene.scene);
        setWhiteboards((current) =>
          sortWhiteboards(current.map((board) => (board.id === updated.id ? updated : board)))
        );
        setSaveStatus("saved");
        setError(null);
      } catch (caught) {
        setSaveStatus("error");
        setError(caught instanceof Error ? caught.message : "Could not save the whiteboard.");
      }
    });
  }, []);

  const queueSceneSave = useCallback(
    (boardId: number, scene: WhiteboardScene) => {
      pendingSceneRef.current = { boardId, scene };
      setSaveStatus("unsaved");

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(flushPendingScene, 900);
    },
    [flushPendingScene]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  function handleCreateWhiteboard() {
    const color = WHITEBOARD_COLORS[whiteboards.length % WHITEBOARD_COLORS.length].value;

    startTransition(async () => {
      try {
        const created = await createWhiteboard({
          name: getNextBoardName(whiteboards.length),
          color,
        });
        setWhiteboards((current) => sortWhiteboards([created, ...current]));
        setSelectedWhiteboardId(created.id);
        setSaveStatus("saved");
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create a whiteboard.");
      }
    });
  }

  function handleSelectWhiteboard(id: number) {
    if (id === selectedWhiteboardId) return;
    flushPendingScene();
    setSelectedWhiteboardId(id);
    setCanvasHandle(null);
    setMoreOpen(false);
    setSaveStatus("saved");
  }

  function handleRenameWhiteboard(board: WhiteboardRecord) {
    const nextName = window.prompt("Rename whiteboard", board.name);
    if (nextName === null) return;

    startTransition(async () => {
      try {
        const updated = await renameWhiteboard(board.id, nextName);
        setWhiteboards((current) =>
          sortWhiteboards(current.map((item) => (item.id === updated.id ? updated : item)))
        );
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the whiteboard.");
      }
    });
  }

  function handleDeleteWhiteboard(board: WhiteboardRecord) {
    const confirmed = window.confirm(`Delete "${board.name}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteWhiteboard(board.id);
        setWhiteboards((current) => {
          const next = current.filter((item) => item.id !== board.id);
          if (selectedWhiteboardId === board.id) {
            setSelectedWhiteboardId(next[0]?.id ?? null);
          }
          return next;
        });
        setMoreOpen(false);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the whiteboard.");
      }
    });
  }

  function handleBoardColorChange(color: WhiteboardColor) {
    if (!selectedWhiteboard) return;

    startTransition(async () => {
      try {
        const updated = await updateWhiteboardColor(selectedWhiteboard.id, color);
        setWhiteboards((current) =>
          sortWhiteboards(current.map((item) => (item.id === updated.id ? updated : item)))
        );
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update board color.");
      }
    });
  }

  function handleColorChange(kind: "stroke" | "background" | "text", color: string) {
    if (kind === "stroke") {
      setStrokeColor(color);
      canvasHandle?.setCanvasColors({ strokeColor: color });
    }

    if (kind === "background") {
      setBackgroundColor(color);
      canvasHandle?.setCanvasColors({ backgroundColor: color });
    }

    if (kind === "text") {
      setTextColor(color);
      canvasHandle?.setCanvasColors({ textColor: color });
    }
  }

  async function handleExportPng() {
    if (!selectedWhiteboard || !canvasHandle) return;

    try {
      await canvasHandle.exportPng(selectedWhiteboard.name);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not export the whiteboard.");
    }
  }

  async function handleGenerateDiagram() {
    if (!canvasHandle) {
      setAiError("Open a whiteboard before generating a diagram.");
      return;
    }

    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError("Enter a prompt for the diagram.");
      return;
    }

    setAiBusy(true);
    setAiError(null);

    try {
      const response = await fetch("/api/whiteboard/ai-diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await response.json()) as AiDiagramResponse;

      if (!response.ok || !Array.isArray(data.elements)) {
        throw new Error(data.error ?? "Could not generate a diagram.");
      }

      canvasHandle.insertDiagramElements(data.elements);
      setAiDialogOpen(false);
      setAiPrompt("");
      setError(null);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "Could not generate a diagram.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-screen overflow-hidden bg-[#F7F7FB]">
      <aside className="flex w-[218px] shrink-0 flex-col border-r border-violet-100 bg-white sm:w-[286px]">
        <div className="border-b border-violet-100 px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PenLine size={15} className="text-pink-500" />
                <h1 className="truncate text-[15px] font-bold text-indigo-950">Whiteboards</h1>
              </div>
              <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">
                {whiteboards.length} board{whiteboards.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateWhiteboard}
            disabled={isPending}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
          >
            <Plus size={14} />
            New Whiteboard
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sidebar-scroll">
          {whiteboards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/60 px-3 py-4 text-[12px] leading-5 text-slate-500">
              Start a blank board for sketches, notes, and diagrams.
            </div>
          ) : (
            <div className="space-y-2">
              {whiteboards.map((board) => (
                <WhiteboardListItem
                  key={board.id}
                  board={board}
                  selected={board.id === selectedWhiteboardId}
                  onSelect={() => handleSelectWhiteboard(board.id)}
                  onRename={() => handleRenameWhiteboard(board)}
                  onDelete={() => handleDeleteWhiteboard(board)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selectedWhiteboard ? (
          <>
            <div className="relative z-20 flex min-h-[58px] items-center justify-between gap-3 border-b border-violet-100 bg-white px-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedWhiteboard.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-indigo-950">
                    {selectedWhiteboard.name}
                  </p>
                  <p className="text-[10.5px] font-medium text-slate-400">
                    Updated {formatUpdatedAt(selectedWhiteboard.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <SaveStatusBadge status={saveStatus} />
                <button
                  type="button"
                  onClick={() => setAiDialogOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-2 text-[11.5px] font-semibold text-violet-700 transition hover:border-violet-200 hover:bg-violet-100 lg:px-2.5"
                >
                  <Wand2 size={13} />
                  <span className="hidden lg:inline">AI Diagram</span>
                </button>
                <button
                  type="button"
                  onClick={() => canvasHandle?.addStickyNote(stickyColor)}
                  disabled={!canvasHandle}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-2 text-[11.5px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 md:px-2.5"
                >
                  <StickyNote size={13} />
                  <span className="hidden md:inline">Sticky</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPng}
                  disabled={!canvasHandle}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11.5px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 md:px-2.5"
                >
                  <Download size={13} />
                  <span className="hidden md:inline">PNG</span>
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((current) => !current)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                    aria-label="More options"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {moreOpen && (
                    <MoreOptionsMenu
                      backgroundColor={backgroundColor}
                      boardColor={selectedWhiteboard.color}
                      stickyColor={stickyColor}
                      strokeColor={strokeColor}
                      textColor={textColor}
                      onBoardColorChange={handleBoardColorChange}
                      onColorChange={handleColorChange}
                      onDelete={() => handleDeleteWhiteboard(selectedWhiteboard)}
                      onFlush={flushPendingScene}
                      onRename={() => handleRenameWhiteboard(selectedWhiteboard)}
                      onStickyColorChange={setStickyColor}
                    />
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-5 py-2 text-[12px] font-medium text-rose-600">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden">
              <WhiteboardCanvas
                key={selectedWhiteboard.id}
                board={selectedWhiteboard}
                onError={setError}
                onReady={setCanvasHandle}
                onSceneChange={queueSceneSave}
              />
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white px-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-pink-50 text-pink-500">
                <PenLine size={22} />
              </div>
              <h2 className="text-[20px] font-bold text-indigo-950">Create a whiteboard</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                Capture sketches, sticky notes, and generated diagrams in one canvas.
              </p>
              <button
                type="button"
                onClick={handleCreateWhiteboard}
                className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <Plus size={14} />
                New Whiteboard
              </button>
            </div>
          </div>
        )}
      </section>

      {aiDialogOpen && (
        <AiDiagramDialog
          busy={aiBusy}
          error={aiError}
          prompt={aiPrompt}
          onClose={() => {
            if (!aiBusy) setAiDialogOpen(false);
          }}
          onGenerate={handleGenerateDiagram}
          onPromptChange={setAiPrompt}
        />
      )}
    </div>
  );
}

function WhiteboardListItem({
  board,
  selected,
  onDelete,
  onRename,
  onSelect,
}: {
  board: WhiteboardRecord;
  selected: boolean;
  onDelete: () => void;
  onRename: () => void;
  onSelect: () => void;
}) {
  const color = getWhiteboardColorMeta(board.color);

  return (
    <div
      className={cn(
        "group rounded-lg border p-2.5 transition",
        selected
          ? "border-violet-200 bg-violet-50 shadow-sm"
          : "border-slate-100 bg-white hover:border-violet-100 hover:bg-slate-50"
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full min-w-0 items-start gap-2 text-left">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color.value }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-indigo-950">
            {board.name}
          </span>
          <span className="mt-0.5 block text-[10.5px] font-medium text-slate-400">
            {formatUpdatedAt(board.updatedAt)}
          </span>
        </span>
      </button>
      <div className="mt-2 flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={onRename}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-violet-600"
          aria-label="Rename whiteboard"
        >
          <Edit3 size={12} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-rose-500"
          aria-label="Delete whiteboard"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "saving" || status === "unsaved") {
    return (
      <span className="hidden h-8 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-600 sm:inline-flex">
        {status === "saving" ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {status === "saving" ? "Saving" : "Unsaved"}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="hidden h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-600 sm:inline-flex">
        <AlertTriangle size={12} />
        Save failed
      </span>
    );
  }

  return (
    <span className="hidden h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-600 sm:inline-flex">
      <CheckCircle2 size={12} />
      Saved
    </span>
  );
}

function MoreOptionsMenu({
  backgroundColor,
  boardColor,
  stickyColor,
  strokeColor,
  textColor,
  onBoardColorChange,
  onColorChange,
  onDelete,
  onFlush,
  onRename,
  onStickyColorChange,
}: {
  backgroundColor: string;
  boardColor: string;
  stickyColor: StickyNoteColor;
  strokeColor: string;
  textColor: string;
  onBoardColorChange: (color: WhiteboardColor) => void;
  onColorChange: (kind: "stroke" | "background" | "text", color: string) => void;
  onDelete: () => void;
  onFlush: () => void;
  onRename: () => void;
  onStickyColorChange: (color: StickyNoteColor) => void;
}) {
  return (
    <div className="absolute right-0 top-10 z-40 w-[290px] overflow-hidden rounded-lg border border-violet-100 bg-white shadow-xl">
      <div className="border-b border-slate-100 px-3 py-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300">
          <Palette size={12} />
          Board color
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WHITEBOARD_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => onBoardColorChange(color.value)}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition",
                boardColor === color.value ? "border-indigo-950" : "border-white"
              )}
              style={{ backgroundColor: color.value }}
              title={color.label}
              aria-label={`Set board color to ${color.label}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-100 px-3 py-3">
        <ColorPickerRow
          label="Stroke"
          value={strokeColor}
          options={drawingColors}
          onChange={(color) => onColorChange("stroke", color)}
        />
        <ColorPickerRow
          label="Background"
          value={backgroundColor}
          options={fillColors}
          onChange={(color) => onColorChange("background", color)}
        />
        <ColorPickerRow
          label="Text"
          value={textColor}
          options={drawingColors}
          onChange={(color) => onColorChange("text", color)}
        />
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Sticky note</p>
          <div className="flex flex-wrap gap-1.5">
            {STICKY_NOTE_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => onStickyColorChange(color.value)}
                className={cn(
                  "h-6 w-6 rounded-md border-2 transition",
                  stickyColor === color.value ? "border-indigo-950" : "border-white"
                )}
                style={{ backgroundColor: color.value }}
                title={color.label}
                aria-label={`Set sticky note color to ${color.label}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-1.5">
        <MenuButton icon={<Save size={13} />} label="Save now" onClick={onFlush} />
        <MenuButton icon={<Edit3 size={13} />} label="Rename" onClick={onRename} />
        <MenuButton danger icon={<Trash2 size={13} />} label="Delete" onClick={onDelete} />
      </div>
    </div>
  );
}

function ColorPickerRow({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (color: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white">
          <input
            aria-label={`${label} custom color`}
            className="h-0 w-0 opacity-0"
            type="color"
            value={value === "transparent" ? "#ffffff" : value}
            onChange={(event) => onChange(event.target.value)}
          />
          <ChevronDown size={12} className="text-slate-400" />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-6 w-6 rounded-md border transition",
              value === color ? "border-indigo-950 ring-2 ring-indigo-100" : "border-slate-200"
            )}
            style={{
              background:
                color === "transparent"
                  ? "linear-gradient(135deg, #fff 0 45%, #e2e8f0 45% 55%, #fff 55% 100%)"
                  : color,
            }}
            aria-label={`Set ${label.toLowerCase()} color`}
          />
        ))}
      </div>
    </div>
  );
}

function MenuButton({
  danger,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-semibold transition",
        danger
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-950"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function AiDiagramDialog({
  busy,
  error,
  prompt,
  onClose,
  onGenerate,
  onPromptChange,
}: {
  busy: boolean;
  error: string | null;
  prompt: string;
  onClose: () => void;
  onGenerate: () => void;
  onPromptChange: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-violet-100 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Bot size={16} />
              </span>
              <h2 className="text-[16px] font-bold text-indigo-950">AI Diagram</h2>
            </div>
            <p className="text-[12px] leading-5 text-slate-400">
              Generate editable Excalidraw elements from a short prompt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:opacity-60"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap gap-2">
            {diagramExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onPromptChange(example)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                <Sparkles size={11} />
                {example}
              </button>
            ))}
          </div>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Describe a flowchart, mind map, architecture diagram, user journey, or process diagram..."
            className="min-h-36 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] leading-6 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Generate diagram
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
