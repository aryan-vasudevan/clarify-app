"use client";

import { useState, useRef, useEffect } from "react";

interface SelectionRect {
    startX: number;
    startY: number;
    width: number;
    height: number;
}

interface ScreenshotAreaProps {
    containerId?: string;
}

export default function ScreenshotArea({ containerId = "pdf-viewer-container" }: ScreenshotAreaProps) {
    const [selection, setSelection] = useState<SelectionRect | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMouseInContainer, setIsMouseInContainer] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLElement | null>(null);

    // Initialize audio and track mouse position globally
    useEffect(() => {
        audioRef.current = new Audio("/camera-shutter.mp3");
        audioRef.current.volume = 0.5;
        
        // Get reference to the PDF container
        containerRef.current = document.getElementById(containerId);

        // Global mouse move listener to track when mouse is in the PDF container
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!containerRef.current || isCapturing || isAnalyzing || selection) {
                return;
            }
            
            const rect = containerRef.current.getBoundingClientRect();
            const inContainer = (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            );
            setIsMouseInContainer(inContainer);
        };

        // Global mouse down listener to start selection when clicking in PDF container
        const handleGlobalMouseDown = (e: MouseEvent) => {
            if (!containerRef.current || isCapturing || isAnalyzing || selection) {
                return;
            }
            
            const rect = containerRef.current.getBoundingClientRect();
            const inContainer = (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            );
            
            if (inContainer) {
                e.preventDefault();
                console.log("Mouse down detected in PDF area, starting selection");
                startPos.current = { x: e.clientX, y: e.clientY };
                setSelection({
                    startX: e.clientX,
                    startY: e.clientY,
                    width: 0,
                    height: 0,
                });
            }
        };

        document.addEventListener("mousemove", handleGlobalMouseMove);
        document.addEventListener("mousedown", handleGlobalMouseDown);

        return () => {
            document.removeEventListener("mousemove", handleGlobalMouseMove);
            document.removeEventListener("mousedown", handleGlobalMouseDown);
        };
    }, [containerId, isCapturing, isAnalyzing, selection]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!selection) return;
        e.preventDefault();
        e.stopPropagation();
        
        const width = e.clientX - startPos.current.x;
        const height = e.clientY - startPos.current.y;
        
        setSelection({
            startX: width < 0 ? e.clientX : startPos.current.x,
            startY: height < 0 ? e.clientY : startPos.current.y,
            width: Math.abs(width),
            height: Math.abs(height),
        });
    };

    const handleMouseUp = async () => {
        if (!selection || selection.width < 10 || selection.height < 10) {
            setSelection(null);
            return;
        }

        // Store selection area before clearing
        const captureArea = { ...selection };

        // Close the selection overlay immediately
        setSelection(null);
        setIsCapturing(true);

        // Dispatch event to notify that screenshot processing is starting
        window.dispatchEvent(new CustomEvent("screenshotProcessing"));

        try {
            // Play camera shutter sound
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch((error) => {
                    console.log("Audio play failed:", error);
                });
            }

            // Longer delay to ensure overlay is completely removed
            await new Promise(resolve => setTimeout(resolve, 150));

            // Find all canvas elements in the PDF container
            const pdfContainer = document.getElementById('pdf-viewer-container');
            if (!pdfContainer) {
                throw new Error("Could not find PDF viewer container");
            }

            const canvasElements = pdfContainer.querySelectorAll('canvas');
            console.log("Found canvas elements:", canvasElements.length);

            // Find the canvas that contains our selection area
            let canvasElement: HTMLCanvasElement | null = null;
            for (const canvas of Array.from(canvasElements)) {
                const rect = canvas.getBoundingClientRect();
                const centerX = captureArea.startX + captureArea.width / 2;
                const centerY = captureArea.startY + captureArea.height / 2;
                
                if (centerX >= rect.left && centerX <= rect.right &&
                    centerY >= rect.top && centerY <= rect.bottom) {
                    canvasElement = canvas as HTMLCanvasElement;
                    break;
                }
            }

            if (!canvasElement) {
                throw new Error("Could not find PDF canvas to capture");
            }

            console.log("Canvas element found:", canvasElement);

            // Get the canvas position
            const canvasRect = canvasElement.getBoundingClientRect();

            console.log("Canvas rect:", canvasRect);

            // Calculate the crop position relative to the canvas element
            const offsetX = captureArea.startX - canvasRect.left;
            const offsetY = captureArea.startY - canvasRect.top;

            console.log("Offset from canvas:", { offsetX, offsetY });

            // Create a new canvas for the cropped region
            const croppedCanvas = document.createElement("canvas");
            croppedCanvas.width = captureArea.width;
            croppedCanvas.height = captureArea.height;

            const ctx = croppedCanvas.getContext("2d");
            if (ctx) {
                // Draw directly from the PDF canvas element
                ctx.drawImage(
                    canvasElement,
                    offsetX,
                    offsetY,
                    captureArea.width,
                    captureArea.height,
                    0,
                    0,
                    captureArea.width,
                    captureArea.height
                );
            }

            const screenshotDataUrl = croppedCanvas.toDataURL("image/png");
            setIsCapturing(false);

            // Start Gemini analysis
            setIsAnalyzing(true);

            try {
                console.log("Sending screenshot to Gemini for analysis...");

                // Send to Gemini for OCR/Visual Analysis
                const ocrResponse = await fetch("/api/ocr", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        imageData: screenshotDataUrl,
                    }),
                });

                console.log("OCR Response status:", ocrResponse.status);

                if (ocrResponse.ok) {
                    const ocrData = await ocrResponse.json();
                    console.log("=== GEMINI ANALYSIS (Client) ===");
                    console.log(ocrData.text);
                    console.log("================================");

                    // Store the Gemini analysis in sessionStorage
                    sessionStorage.setItem("geminiAnalysis", ocrData.text);
                    sessionStorage.setItem("screenshotImage", screenshotDataUrl);
                    sessionStorage.setItem("screenshotTimestamp", new Date().toISOString());

                    // Dispatch a custom event to notify the viewer that a new screenshot is ready
                    window.dispatchEvent(new CustomEvent("newScreenshot", {
                        detail: {
                            analysis: ocrData.text,
                            image: screenshotDataUrl,
                            timestamp: new Date().toISOString()
                        }
                    }));
                } else {
                    const errorData = await ocrResponse.json();
                    console.error("OCR failed:", errorData);
                    alert(`Failed to analyze screenshot: ${errorData.details || errorData.error || 'Unknown error'}`);
                }
            } catch (analysisError) {
                console.error("Gemini analysis failed:", analysisError);
                alert("Failed to analyze with Gemini: " + (analysisError instanceof Error ? analysisError.message : String(analysisError)));
            } finally {
                setIsAnalyzing(false);
            }
        } catch (error) {
            console.error("Screenshot capture failed:", error);
            alert("Failed to capture screenshot");
            setIsCapturing(false);
        }
    };

    // Handle ESC key press
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && selection) {
                setSelection(null);
            }
        };

        if (selection) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [selection]);

    // Update cursor style when hovering over PDF area
    useEffect(() => {
        if (containerRef.current && isMouseInContainer && !selection && !isCapturing && !isAnalyzing) {
            containerRef.current.style.cursor = "crosshair";
        } else if (containerRef.current) {
            containerRef.current.style.cursor = "";
        }
    }, [isMouseInContainer, selection, isCapturing, isAnalyzing]);

    return (
        <>
            {/* Analyzing indicator */}
            {isAnalyzing && (
                <div className="fixed top-20 right-6 z-50 bg-purple-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-semibold">Gemini analyzing...</span>
                </div>
            )}


            {/* Selection Overlay - Only appears when actively selecting */}
            {selection && !isCapturing && !isAnalyzing && (
                <div
                    className="fixed inset-0 select-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        cursor: "crosshair",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                        zIndex: 60,
                        pointerEvents: "all",
                    }}
                >
                    {/* Selection Rectangle */}
                    {selection.width > 0 && selection.height > 0 && (
                        <div
                            className="absolute border-2 border-blue-500 bg-blue-500/20"
                            style={{
                                left: `${selection.startX}px`,
                                top: `${selection.startY}px`,
                                width: `${selection.width}px`,
                                height: `${selection.height}px`,
                                pointerEvents: "none",
                            }}
                        >
                            {/* Corner handles */}
                            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
                            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                            
                            {/* Dimensions display */}
                            <div className="absolute -bottom-8 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                {Math.round(selection.width)} × {Math.round(selection.height)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

