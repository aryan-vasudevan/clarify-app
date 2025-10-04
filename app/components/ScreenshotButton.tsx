"use client";

import { useState, useRef, useEffect } from "react";

interface SelectionRect {
    startX: number;
    startY: number;
    width: number;
    height: number;
}

export default function ScreenshotButton() {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selection, setSelection] = useState<SelectionRect | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio("/camera-shutter.mp3");
        audioRef.current.volume = 0.5;
    }, []);

    const handleButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSelecting(true);
        setSelection(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isSelecting) return;
        e.preventDefault();
        e.stopPropagation();
        startPos.current = { x: e.clientX, y: e.clientY };
        setSelection({
            startX: e.clientX,
            startY: e.clientY,
            width: 0,
            height: 0,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !selection) return;
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
        if (!isSelecting || !selection || selection.width < 10 || selection.height < 10) {
            setIsSelecting(false);
            setSelection(null);
            return;
        }

        // Store selection area before clearing
        const captureArea = { ...selection };

        // Close the selection overlay immediately
        setIsSelecting(false);
        setSelection(null);
        setIsCapturing(true);

        try {
            // Play camera shutter sound
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch((error) => {
                    console.log("Audio play failed:", error);
                });
            }

            // Longer delay to ensure overlay is completely removed
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get all elements at the selected position
            const elementsAtPosition = document.elementsFromPoint(
                captureArea.startX + captureArea.width / 2,
                captureArea.startY + captureArea.height / 2
            );

            console.log("Elements at position:", elementsAtPosition);

            // Find the canvas element from react-pdf (this has the actual PDF rendered)
            const canvasElement = elementsAtPosition.find(el => el.tagName === 'CANVAS') as HTMLCanvasElement;

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
                    const errorText = await ocrResponse.text();
                    console.error("OCR failed:", errorText);
                    alert("Failed to analyze screenshot with Gemini");
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
            if (e.key === "Escape" && isSelecting) {
                setIsSelecting(false);
                setSelection(null);
            }
        };

        if (isSelecting) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isSelecting]);

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

            <button
                type="button"
                id="screenshot-button"
                onClick={handleButtonClick}
                disabled={isCapturing || isSelecting || isAnalyzing}
                className="fixed top-6 right-20 z-50 w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:scale-110 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Take screenshot"
                title="Take screenshot"
            >
                <svg
                    className={`w-6 h-6 text-gray-700 dark:text-gray-200 transition-transform duration-300 ${
                        isCapturing ? "scale-90" : "scale-100"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
            </button>

            {/* Selection Overlay */}
            {isSelecting && (
                <div
                    className="fixed inset-0 z-[60] cursor-crosshair select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                    }}
                >
                    {/* Instructions */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            Drag to select area • Press ESC to cancel
                        </p>
                    </div>

                    {/* Selection Rectangle */}
                    {selection && selection.width > 0 && selection.height > 0 && (
                        <div
                            className="absolute border-2 border-blue-500 bg-blue-500/20"
                            style={{
                                left: `${selection.startX}px`,
                                top: `${selection.startY}px`,
                                width: `${selection.width}px`,
                                height: `${selection.height}px`,
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

