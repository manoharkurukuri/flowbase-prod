"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  convertToExcalidrawElements,
  exportToBlob,
  restoreAppState,
  restoreElements,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  EMPTY_WHITEBOARD_SCENE,
  getStickyNoteColorMeta,
  type StickyNoteColor,
  type WhiteboardRecord,
  type WhiteboardScene,
} from "@/lib/whiteboard";

export type DiagramElementSkeleton = Record<string, unknown>;

export type WhiteboardCanvasHandle = {
  addStickyNote: (color: StickyNoteColor) => void;
  exportPng: (fileName: string) => Promise<void>;
  insertDiagramElements: (elements: DiagramElementSkeleton[]) => void;
  setCanvasColors: (colors: {
    strokeColor?: string;
    backgroundColor?: string;
    textColor?: string;
  }) => void;
};

type WhiteboardCanvasProps = {
  board: WhiteboardRecord;
  onReady: (handle: WhiteboardCanvasHandle | null) => void;
  onSceneChange: (boardId: number, scene: WhiteboardScene) => void;
  onError: (message: string) => void;
};

function coerceScene(parsed: unknown): WhiteboardScene {
  if (!parsed || typeof parsed !== "object") {
    return { ...EMPTY_WHITEBOARD_SCENE };
  }

  const scene = parsed as Partial<WhiteboardScene>;

  return {
    type: typeof scene.type === "string" ? scene.type : "excalidraw",
    version: typeof scene.version === "number" ? scene.version : 2,
    source: typeof scene.source === "string" ? scene.source : "flowbase",
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState:
      scene.appState && typeof scene.appState === "object" && !Array.isArray(scene.appState)
        ? scene.appState
        : EMPTY_WHITEBOARD_SCENE.appState,
    files:
      scene.files && typeof scene.files === "object" && !Array.isArray(scene.files)
        ? scene.files
        : {},
  };
}

function sanitizeFileName(name: string) {
  return (
    name
      .trim()
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "whiteboard"
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadBlankPng(fileName: string, backgroundColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) {
    downloadBlob(blob, fileName);
  }
}

function offsetDiagramElement(element: DiagramElementSkeleton, offsetX: number, offsetY: number) {
  return {
    ...element,
    x: typeof element.x === "number" ? element.x + offsetX : offsetX,
    y: typeof element.y === "number" ? element.y + offsetY : offsetY,
  };
}

function getZoomValue(zoom: unknown) {
  if (zoom && typeof zoom === "object" && "value" in zoom) {
    const value = (zoom as { value?: unknown }).value;
    return typeof value === "number" && Number.isFinite(value) ? value : 1;
  }

  return 1;
}

export function WhiteboardCanvas({
  board,
  onReady,
  onSceneChange,
  onError,
}: WhiteboardCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const initialData = useMemo(() => {
    const scene = board.scene ?? EMPTY_WHITEBOARD_SCENE;
    const viewBackgroundColor =
      typeof scene.appState?.viewBackgroundColor === "string"
        ? scene.appState.viewBackgroundColor
        : "#FFFDF7";

    return {
      elements: restoreElements(scene.elements as never[], null, {
        repairBindings: true,
      }),
      appState: restoreAppState(
        {
          ...scene.appState,
          viewBackgroundColor,
          currentItemStrokeColor: "#1E293B",
          currentItemBackgroundColor: "transparent",
          currentItemFontFamily: 2,
        },
        null
      ),
      files: scene.files as never,
      scrollToContent: scene.elements.length > 0,
    };
  }, [board.id, board.scene]);

  const getViewportInsertPoint = useCallback(() => {
    if (!excalidrawAPI) {
      return { x: 80, y: 80 };
    }

    const appState = excalidrawAPI.getAppState() as Record<string, unknown>;
    const zoom = getZoomValue(appState.zoom);
    const width = containerRef.current?.clientWidth ?? 1100;
    const height = containerRef.current?.clientHeight ?? 720;
    const scrollX = typeof appState.scrollX === "number" ? appState.scrollX : 0;
    const scrollY = typeof appState.scrollY === "number" ? appState.scrollY : 0;

    return {
      x: Math.round((width * 0.18 - scrollX) / zoom),
      y: Math.round((height * 0.18 - scrollY) / zoom),
    };
  }, [excalidrawAPI]);

  const handleSceneChange = useCallback(
    (elements: Parameters<typeof serializeAsJSON>[0], appState: Parameters<typeof serializeAsJSON>[1], files: Parameters<typeof serializeAsJSON>[2]) => {
      try {
        const serialized = serializeAsJSON(elements, appState, files, "local");
        onSceneChange(board.id, coerceScene(JSON.parse(serialized)));
      } catch {
        onError("Could not serialize the whiteboard scene.");
      }
    },
    [board.id, onError, onSceneChange]
  );

  useEffect(() => {
    if (!excalidrawAPI) {
      onReady(null);
      return;
    }

    const handle: WhiteboardCanvasHandle = {
      addStickyNote: (color) => {
        const meta = getStickyNoteColorMeta(color);
        const { x, y } = getViewportInsertPoint();
        const elements = convertToExcalidrawElements([
          {
            type: "rectangle",
            x,
            y,
            width: 220,
            height: 150,
            backgroundColor: meta.value,
            strokeColor: meta.border,
            fillStyle: "solid",
            strokeWidth: 2,
            roughness: 1,
            label: {
              text: "Sticky note",
              fontSize: 20,
              strokeColor: meta.text,
            },
            customData: {
              kind: "sticky-note",
            },
          },
        ]);

        excalidrawAPI.updateScene({
          elements: [...excalidrawAPI.getSceneElements(), ...elements],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      },
      exportPng: async (fileName) => {
        const elements = excalidrawAPI.getSceneElements();
        const visibleElements = elements.filter((element) => !element.isDeleted);
        const appState = excalidrawAPI.getAppState();
        const downloadName = `${sanitizeFileName(fileName)}.png`;

        if (visibleElements.length === 0) {
          await downloadBlankPng(
            downloadName,
            typeof appState.viewBackgroundColor === "string"
              ? appState.viewBackgroundColor
              : "#FFFDF7"
          );
          return;
        }

        const blob = await exportToBlob({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            exportWithDarkMode: false,
          },
          files: excalidrawAPI.getFiles(),
          mimeType: "image/png",
          exportPadding: 28,
        });

        downloadBlob(blob, downloadName);
      },
      insertDiagramElements: (diagramElements) => {
        const { x, y } = getViewportInsertPoint();
        const elements = convertToExcalidrawElements(
          diagramElements.map((element) => offsetDiagramElement(element, x, y)) as never[]
        );

        excalidrawAPI.updateScene({
          elements: [...excalidrawAPI.getSceneElements(), ...elements],
          appState: {
            selectedElementIds: Object.fromEntries(elements.map((element) => [element.id, true])),
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      },
      setCanvasColors: ({ strokeColor, backgroundColor, textColor }) => {
        const appState = excalidrawAPI.getAppState();

        excalidrawAPI.updateScene({
          appState: {
            currentItemStrokeColor:
              textColor ?? strokeColor ?? appState.currentItemStrokeColor,
            currentItemBackgroundColor:
              backgroundColor ?? appState.currentItemBackgroundColor,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      },
    };

    onReady(handle);
    return () => onReady(null);
  }, [excalidrawAPI, getViewportInsertPoint, onReady]);

  return (
    <div ref={containerRef} className="whiteboard-canvas h-full min-h-0 w-full overflow-hidden bg-white">
      <Excalidraw
        key={board.id}
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
        name={board.name}
        theme="light"
        gridModeEnabled={false}
        aiEnabled={false}
        onChange={handleSceneChange}
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveAsImage: false,
            saveToActiveFile: false,
          },
          tools: {
            image: true,
          },
        }}
      />
    </div>
  );
}
