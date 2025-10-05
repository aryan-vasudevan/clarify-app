"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Annotation {
    id: string;
    x: number;
    y: number;
    text: string;
    fileIndex: number;
    width?: number;
    height?: number;
}

interface AnnotationOverlayProps {
    isAnnotationMode: boolean;
    annotations: Annotation[];
    currentFileIndex: number;
    onAddAnnotation: (annotation: Omit<Annotation, "id">) => void;
    onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
    onDeleteAnnotation: (id: string) => void;
    containerId: string;
}

export default function AnnotationOverlay({
    isAnnotationMode,
    annotations,
    currentFileIndex,
    onAddAnnotation,
    onUpdateAnnotation,
    onDeleteAnnotation,
    containerId,
}: AnnotationOverlayProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [mouseDownTime, setMouseDownTime] = useState(0);
    const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLElement | null>(null);
    const dragThreshold = 5; // pixels to move before considering it a drag
    const holdThreshold = 150; // ms to hold before dragging

    // Filter annotations for current file
    const currentAnnotations = annotations.filter(
        (a) => a.fileIndex === currentFileIndex
    );

    const handleContainerClick = useCallback((e: MouseEvent | React.MouseEvent) => {
        if (!isAnnotationMode) return;

        // Check if clicking on empty space
        const target = e.target as HTMLElement;
        if (target.closest('.annotation-box')) {
            return; // Clicked on annotation, not empty space
        }

        // Deselect any selected annotation if clicking outside
        if (selectedId || editingId) {
            setSelectedId(null);
            setEditingId(null);
            return; // Don't create new annotation when deselecting
        }

        // Get container bounds
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + container.scrollTop;

        // Create new annotation
        onAddAnnotation({
            x,
            y,
            text: "",
            fileIndex: currentFileIndex,
        });
    }, [isAnnotationMode, selectedId, editingId, onAddAnnotation, currentFileIndex]);

    // Setup container click listener
    useEffect(() => {
        const container = document.getElementById(containerId);
        containerRef.current = container;
        
        // Add click listener to container
        if (container) {
            container.addEventListener('click', handleContainerClick as any);
        }
        
        return () => {
            if (container) {
                container.removeEventListener('click', handleContainerClick as any);
            }
        };
    }, [containerId, handleContainerClick]);

    // Auto-edit newly created annotations
    useEffect(() => {
        // Find the most recent annotation with empty text
        const newAnnotation = currentAnnotations.find(
            a => a.text === "" && a.id !== editingId
        );
        
        if (newAnnotation && isAnnotationMode) {
            setEditingId(newAnnotation.id);
            setSelectedId(newAnnotation.id);
        }
    }, [annotations.length, isAnnotationMode]);

    const handleAnnotationMouseDown = (
        e: React.MouseEvent,
        annotation: Annotation
    ) => {
        if (!isAnnotationMode) return;
        e.stopPropagation();

        setMouseDownTime(Date.now());
        setMouseDownPos({ x: e.clientX, y: e.clientY });
        setSelectedId(annotation.id);
    };

    const handleAnnotationMouseMove = (e: MouseEvent) => {
        if (!mouseDownTime) return;

        const timeSinceMouseDown = Date.now() - mouseDownTime;
        const distanceMoved = Math.sqrt(
            Math.pow(e.clientX - mouseDownPos.x, 2) +
            Math.pow(e.clientY - mouseDownPos.y, 2)
        );

        // Start dragging if held for threshold time or moved beyond threshold
        if (
            !draggingId &&
            selectedId &&
            (timeSinceMouseDown > holdThreshold || distanceMoved > dragThreshold)
        ) {
            setDraggingId(selectedId);
            const annotation = annotations.find(a => a.id === selectedId);
            if (annotation && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDragOffset({
                    x: e.clientX - rect.left - annotation.x,
                    y: e.clientY - rect.top - annotation.y + containerRef.current.scrollTop,
                });
            }
        }

        // Update position if dragging
        if (draggingId && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left - dragOffset.x;
            const y = e.clientY - rect.top - dragOffset.y + containerRef.current.scrollTop;
            onUpdateAnnotation(draggingId, { x, y });
        }
    };

    const handleAnnotationMouseUp = () => {
        const wasDragging = draggingId !== null;
        
        setDraggingId(null);
        setMouseDownTime(0);
        
        // If it wasn't a drag, it was just a click - don't do anything (keep selected)
    };

    const handleAnnotationDoubleClick = (
        e: React.MouseEvent,
        annotation: Annotation
    ) => {
        if (!isAnnotationMode) return;
        e.stopPropagation();
        setEditingId(annotation.id);
    };

    const handleResizeStart = (
        e: React.MouseEvent,
        annotation: Annotation
    ) => {
        if (!isAnnotationMode) return;
        e.stopPropagation();
        setResizingId(annotation.id);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: annotation.width || 200,
            height: annotation.height || 60,
        });
    };

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizingId || !containerRef.current) return;

        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;

        const newWidth = Math.max(100, resizeStart.width + deltaX);
        const newHeight = Math.max(40, resizeStart.height + deltaY);

        onUpdateAnnotation(resizingId, {
            width: newWidth,
            height: newHeight,
        });
    }, [resizingId, resizeStart, onUpdateAnnotation]);

    const handleResizeEnd = useCallback(() => {
        setResizingId(null);
    }, []);

    useEffect(() => {
        if (mouseDownTime) {
            document.addEventListener("mousemove", handleAnnotationMouseMove);
            document.addEventListener("mouseup", handleAnnotationMouseUp);

            return () => {
                document.removeEventListener("mousemove", handleAnnotationMouseMove);
                document.removeEventListener("mouseup", handleAnnotationMouseUp);
            };
        }
    }, [mouseDownTime, mouseDownPos, draggingId, selectedId, dragOffset, annotations]);

    useEffect(() => {
        if (resizingId) {
            document.addEventListener("mousemove", handleResizeMove);
            document.addEventListener("mouseup", handleResizeEnd);

            return () => {
                document.removeEventListener("mousemove", handleResizeMove);
                document.removeEventListener("mouseup", handleResizeEnd);
            };
        }
    }, [resizingId, handleResizeMove, handleResizeEnd]);

    if (!isAnnotationMode && currentAnnotations.length === 0) {
        return null;
    }

    return (
        <>
            {/* Annotation markers */}
            {currentAnnotations.map((annotation) => (
                <div
                    key={annotation.id}
                    className="absolute group annotation-box"
                    style={{
                        left: `${annotation.x}px`,
                        top: `${annotation.y}px`,
                        transform: "translate(-50%, -50%)",
                        zIndex: editingId === annotation.id ? 30 : selectedId === annotation.id ? 25 : 20,
                        pointerEvents: "all",
                    }}
                    onMouseDown={(e) => handleAnnotationMouseDown(e, annotation)}
                    onDoubleClick={(e) => handleAnnotationDoubleClick(e, annotation)}
                >
                    {/* Annotation Box */}
                    <div
                        className={`
                            relative px-2 py-1 rounded shadow-lg
                            border-2 border-black
                            transition-all duration-200
                            ${draggingId === annotation.id ? "cursor-grabbing scale-105" : resizingId === annotation.id ? "cursor-nwse-resize" : isAnnotationMode ? "cursor-grab" : ""}
                            ${selectedId === annotation.id ? "shadow-xl border-blue-500" : ""}
                            ${editingId === annotation.id ? "border-blue-500" : ""}
                        `}
                        style={{
                            width: annotation.width || (editingId === annotation.id ? '200px' : 'fit-content'),
                            height: annotation.height || 'auto',
                            maxWidth: '400px',
                            minWidth: editingId === annotation.id ? '150px' : 'auto',
                            minHeight: '40px',
                            backgroundColor: 'rgba(255, 255, 240, 0.7)', // Slight light yellow highlight
                        }}
                    >
                        {editingId === annotation.id ? (
                            <textarea
                                value={annotation.text}
                                onChange={(e) =>
                                    onUpdateAnnotation(annotation.id, {
                                        text: e.target.value,
                                    })
                                }
                                onBlur={() => {
                                    setEditingId(null);
                                    // Delete if empty
                                    if (annotation.text.trim() === "") {
                                        onDeleteAnnotation(annotation.id);
                                    }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                autoFocus
                                placeholder="Type annotation..."
                                className="w-full bg-transparent border-none outline-none resize-none text-black text-sm placeholder-gray-500"
                                rows={3}
                            />
                        ) : (
                            <div className="text-sm text-black whitespace-nowrap min-h-[20px]">
                                {annotation.text || "Empty annotation"}
                            </div>
                        )}

                        {/* Delete button - only visible when selected in annotation mode */}
                        {isAnnotationMode && selectedId === annotation.id && editingId !== annotation.id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteAnnotation(annotation.id);
                                }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-opacity"
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                ×
                            </button>
                        )}

                        {/* Resize handle - only visible when selected in annotation mode */}
                        {isAnnotationMode && selectedId === annotation.id && editingId !== annotation.id && (
                            <div
                                onMouseDown={(e) => handleResizeStart(e, annotation)}
                                className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 hover:bg-blue-600 rounded-full cursor-nwse-resize transition-opacity"
                                style={{
                                    background: 'linear-gradient(135deg, transparent 40%, #3b82f6 40%)',
                                }}
                            />
                        )}
                    </div>
                </div>
            ))}
        </>
    );
}
