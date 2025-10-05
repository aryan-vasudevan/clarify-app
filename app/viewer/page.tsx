"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Conversation } from "@elevenlabs/client";
import ScreenshotArea from "../components/ScreenshotButton";
import ThemeToggle from "../components/ThemeToggle";
import AnnotationOverlay from "../components/AnnotationOverlay";
import html2canvas from "html2canvas";

// Dynamically import react-pdf components with SSR disabled
const Document = dynamic(
    () => import("react-pdf").then((mod) => mod.Document),
    { ssr: false }
);
const Page = dynamic(
    () => import("react-pdf").then((mod) => mod.Page),
    { ssr: false }
);

// Import CSS files
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface FileData {
    name: string;
    type: string;
    dataUrl?: string;
}

interface ChatMessage {
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
}

interface Annotation {
    id: string;
    x: number;
    y: number;
    text: string;
    fileIndex: number;
    width?: number;
    height?: number;
}

export default function Viewer() {
    const router = useRouter();
    const [files, setFiles] = useState<FileData[]>([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState(1.0);
    const [agentId, setAgentId] = useState<string | null>(null);
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [showScreenshotBanner, setShowScreenshotBanner] = useState(true);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isAnnotationMode, setIsAnnotationMode] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isFKeyHeld, setIsFKeyHeld] = useState(false);
    const [voices, setVoices] = useState<any[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>("");
    const conversationRef = useRef<Conversation>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Helper function to truncate message
    const truncateMessage = (text: string, wordLimit: number = 5) => {
        const words = text.split(' ');
        if (words.length <= wordLimit) return text;
        return words.slice(0, wordLimit).join(' ') + '...';
    };

    // Ensure client-side only rendering
    useEffect(() => {
        setIsMounted(true);

        // Configure PDF.js worker on client side only
        import("react-pdf").then((pdfjs) => {
            pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`;
        });
    }, []);

    useEffect(() => {
        // Load files from sessionStorage
        const filesData = sessionStorage.getItem("uploadedFiles");
        if (!filesData) {
            router.push("/");
            return;
        }

        const parsedFiles: FileData[] = JSON.parse(filesData);
        const filesWithData = parsedFiles.map((file) => ({
            ...file,
            dataUrl: sessionStorage.getItem(`file_${file.name}`) || undefined,
        }));

        setFiles(filesWithData);

        // Fetch available voices
        fetch('/api/voices')
            .then(res => res.json())
            .then(data => {
                if (data.voices) {
                    setVoices(data.voices);
                    // Set default voice if available
                    if (data.voices.length > 0) {
                        setSelectedVoice(data.voices[0].voice_id);
                    }
                }
            })
            .catch(err => console.error('Failed to fetch voices:', err));
    }, [router]);

    // F key detection for talk-to-agent control
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'f' || e.key === 'F') {
                if (!isFKeyHeld) {
                    setIsFKeyHeld(true);
                    // Unmute microphone when F is pressed
                    if (conversationRef.current && isConnected) {
                        try {
                            conversationRef.current.setMicMuted(false);
                        } catch (error) {
                            console.error("Failed to unmute mic:", error);
                        }
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'f' || e.key === 'F') {
                setIsFKeyHeld(false);
                // Mute microphone when F is released
                if (conversationRef.current && isConnected) {
                    try {
                        conversationRef.current.setMicMuted(true);
                    } catch (error) {
                        console.error("Failed to mute mic:", error);
                    }
                }
            }
        };

        if (isConnected) {
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isFKeyHeld, isConnected]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const goToPrevFile = () => {
        if (currentFileIndex > 0) {
            setCurrentFileIndex(currentFileIndex - 1);
        }
    };

    const goToNextFile = () => {
        if (currentFileIndex < files.length - 1) {
            setCurrentFileIndex(currentFileIndex + 1);
        }
    };

    const zoomIn = () => {
        setScale((prev) => Math.min(prev + 0.2, 1.7));
    };

    const zoomOut = () => {
        setScale((prev) => Math.max(prev - 0.2, 0.5));
    };

    const resetZoom = () => {
        setScale(1.0);
    };

    // Annotation handlers
    const handleAddAnnotation = (annotation: Omit<Annotation, "id">) => {
        const newAnnotation: Annotation = {
            ...annotation,
            id: `annotation-${Date.now()}-${Math.random()}`,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
    };

    const handleUpdateAnnotation = (id: string, updates: Partial<Annotation>) => {
        setAnnotations((prev) =>
            prev.map((ann) => (ann.id === id ? { ...ann, ...updates } : ann))
        );
    };

    const handleDeleteAnnotation = (id: string) => {
        setAnnotations((prev) => prev.filter((ann) => ann.id !== id));
    };

    const downloadAnnotatedPDF = async () => {
        const pdfContainer = document.getElementById("pdf-viewer-container");
        if (!pdfContainer) {
            alert("PDF container not found");
            return;
        }

        setIsDownloading(true);

        try {
            // Temporarily disable annotation mode to hide selection UI
            const wasAnnotationMode = isAnnotationMode;
            if (wasAnnotationMode) {
                setIsAnnotationMode(false);
            }

            // Wait for state to update and UI to stabilize
            await new Promise(resolve => setTimeout(resolve, 300));

            // Capture the PDF container with annotations
            const canvas = await html2canvas(pdfContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: true, // Enable logging to debug
                backgroundColor: "#e5e7eb",
                windowWidth: pdfContainer.scrollWidth,
                windowHeight: pdfContainer.scrollHeight,
                scrollX: 0,
                scrollY: -pdfContainer.scrollTop,
                onclone: (clonedDoc) => {
                    // Fix oklch colors by converting them to hex
                    const clonedContainer = clonedDoc.getElementById("pdf-viewer-container");
                    if (clonedContainer) {
                        // Force standard colors on all elements
                        clonedContainer.style.backgroundColor = "#e5e7eb";
                        const allElements = clonedContainer.getElementsByTagName("*");
                        for (let i = 0; i < allElements.length; i++) {
                            const el = allElements[i] as HTMLElement;
                            const computedStyle = window.getComputedStyle(el);
                            // Convert computed colors to inline styles
                            if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                                el.style.backgroundColor = computedStyle.backgroundColor;
                            }
                            if (computedStyle.color) {
                                el.style.color = computedStyle.color;
                            }
                            if (computedStyle.borderColor) {
                                el.style.borderColor = computedStyle.borderColor;
                            }
                        }
                    }
                },
            });

            // Restore annotation mode
            if (wasAnnotationMode) {
                setIsAnnotationMode(true);
            }

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    const filename = currentFile?.name ? 
                        `${currentFile.name.replace('.pdf', '')}_annotated.png` : 
                        'annotated_pdf.png';
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setIsDownloading(false);
                } else {
                    throw new Error("Failed to create blob from canvas");
                }
            }, 'image/png');

        } catch (error) {
            console.error("Error downloading annotated PDF:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to download annotated PDF: ${errorMessage}`);
            
            // Make sure to restore annotation mode even if error occurs
            setIsAnnotationMode(isAnnotationMode);
            setIsDownloading(false);
        }
    };

    const createAgent = async () => {
        setIsCreating(true);
        try {
            // Upload all PDFs to knowledge base
            const documentIds: string[] = [];
            for (const file of files) {
                if (!file.dataUrl) continue;

                // Convert data URL back to File
                const response = await fetch(file.dataUrl);
                const blob = await response.blob();
                const fileObj = new File([blob], file.name, {
                    type: file.type,
                });

                const formData = new FormData();
                formData.append("file", fileObj);
                formData.append("name", file.name.replace(".pdf", ""));

                const kbResponse = await fetch("/api/knowledge-base/create", {
                    method: "POST",
                    body: formData,
                });

                if (!kbResponse.ok) {
                    throw new Error(
                        `Failed to create knowledge base for ${file.name}`
                    );
                }

                const kbData = await kbResponse.json();
                documentIds.push(kbData.document_id);
            }

            setKnowledgeBaseIds(documentIds);

            const agentResponse = await fetch("/api/agents/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    knowledgeBaseIds: documentIds,
                    fileNames: files.map((f) => f.name.replace(".pdf", "")),
                    voiceId: selectedVoice,
                }),
            });

            if (!agentResponse.ok) {
                throw new Error("Failed to create agent");
            }

            const agentData = await agentResponse.json();
            setAgentId(agentData.agent_id);
            return agentData.agent_id; // Return the agent ID
        } catch (error) {
            console.error("Error creating agent:", error);
            alert("Failed to create agent");
            throw error;
        } finally {
            setIsCreating(false);
        }
    };

    const startConversation = async (agentIdToUse?: string) => {
        const idToUse = agentIdToUse || agentId;
        if (!idToUse) return;

        try {
            const conversation = await Conversation.startSession({
                agentId: idToUse,
                connectionType: "webrtc",
                onConnect: () => {
                    console.log("Connected to agent");
                    setIsConnected(true);
                },
                onDisconnect: () => {
                    console.log("Disconnected from agent");
                    setIsConnected(false);
                },
                onError: (error) => {
                    console.error("Conversation error:", error);
                },
                onMessage: (message) => {
                    console.log("Full message object:", message);
                    console.log("Message source (role):", message.source);
                    console.log("Message content:", message.message);

                    // Check if this is a user message or agent message based on source
                    const isUserMessage = message.source === 'user';
                    const messageRole = isUserMessage ? 'user' : 'agent';
                    const messageContent = message.message;

                    console.log("Determined role:", messageRole);
                    console.log("Content:", messageContent);

                    // Only add to chat history if there's actual text content
                    if (messageContent && messageContent.trim().length > 0) {
                        setChatHistory(prev => {
                            const lastMsg = prev[prev.length - 1];
                            console.log("Last message in history:", lastMsg);

                            // If last message was from same role, append to it
                            if (lastMsg && lastMsg.role === messageRole) {
                                console.log("Appending to existing", messageRole, "message");
                                return [
                                    ...prev.slice(0, -1),
                                    {
                                        ...lastMsg,
                                        content: lastMsg.content + ' ' + messageContent,
                                        timestamp: new Date()
                                    }
                                ];
                            }
                            // Otherwise create new message
                            console.log("Creating new", messageRole, "message");
                            return [...prev, {
                                role: messageRole,
                                content: messageContent,
                                timestamp: new Date()
                            }];
                        });
                    }
                },
                onModeChange: (mode) => {
                    console.log("Mode change:", mode);
                },
            });
            conversationRef.current = conversation;

            // Start with microphone muted (user must press F to talk)
            conversation.setMicMuted(true);

            console.log(conversationRef);
        } catch (error) {
            console.error("Error starting conversation:", error);
            throw error;
        }
    };

    // Auto-scroll to latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // Listen for screenshot events and send to conversation
    useEffect(() => {
        const handleNewScreenshot = (event: CustomEvent) => {
            if (!conversationRef.current || !isConnected) {
                console.log("Screenshot taken but conversation not active");
                return;
            }

            const { analysis } = event.detail;

            // Add user message to chat history as "sent a diagram or something"
            setChatHistory(prev => {
                const lastMsg = prev[prev.length - 1];
                // If last message was from user, append to it
                if (lastMsg && lastMsg.role === 'user') {
                    return [
                        ...prev.slice(0, -1),
                        {
                            ...lastMsg,
                            content: lastMsg.content + ', sent a diagram',
                            timestamp: new Date()
                        }
                    ];
                }
                // Otherwise create new message
                return [...prev, {
                    role: 'user',
                    content: '* Sent a Diagram *',
                    timestamp: new Date()
                }];
            });

            // Send the analysis to the conversation with proper diagram instruction
            const message = `I've highlighted a diagram in my textbook. Here's what it contains:\n\n${analysis}\n\nPlease start your response with "Of course! I'll explain the [diagram type] diagram for you!" where you identify what type of diagram this is based on the content, then explain it to me. Remember, this is always a diagram, never an excerpt or text passage.`;

            console.log(
                "Sending screenshot analysis to conversation:",
                message
            );

            try {
                conversationRef.current.sendUserMessage(message);
            } catch (error) {
                console.error(
                    "Failed to send screenshot to conversation:",
                    error
                );
            }
        };

        window.addEventListener(
            "newScreenshot",
            handleNewScreenshot as EventListener
        );

        return () => {
            window.removeEventListener(
                "newScreenshot",
                handleNewScreenshot as EventListener
            );
        };
    }, [isConnected]);

    const stopConversation = async () => {
        try {
            if (conversationRef.current) {
                await conversationRef.current.endSession();
                conversationRef.current = null;
            }

            if (agentId) {
                const agentResponse = await fetch("/api/agents/delete", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        agent_id: agentId,
                    }),
                });

                if (!agentResponse.ok) {
                    throw new Error("Failed to delete agent");
                }

                setAgentId(null);
            }

            for (const docId of knowledgeBaseIds) {
                const kbResponse = await fetch("/api/knowledge-base/delete", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        document_id: docId,
                    }),
                });

                if (!kbResponse.ok) {
                    throw new Error("Failed to delete knowledge base");
                }
            }

            setKnowledgeBaseIds([]);
            setIsConnected(false);
        } catch (error) {
            console.error("Error stopping conversation:", error);
            alert("Failed to stop conversation");
        }
    };

    if (files.length === 0 || !isMounted) {
        return null;
    }

    const currentFile = files[currentFileIndex];

    return (
        <div
            className="h-screen flex"
            style={{ fontFamily: "var(--font-geist-mono)" }}
        >
            <ScreenshotArea containerId="pdf-viewer-container" isDisabled={isAnnotationMode} />
            <ThemeToggle />
            {/* Left side - PDF Viewer */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                {/* Header with file navigation */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2.5 transition-colors duration-300">
                    <div className="flex items-center">
                        {/* Left section (1/5) - Back button */}
                        <div className="w-1/5 flex justify-start">
                            <button
                                onClick={() => router.push("/")}
                                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 flex items-center transition-colors text-sm"
                            >
                                <svg
                                    className="w-4 h-4 mr-1.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                                Back
                            </button>
                        </div>

                        {/* Center section (3/5) - File navigation */}
                        <div className="w-3/5 flex items-center justify-center space-x-3">
                            <button
                                onClick={goToPrevFile}
                                disabled={currentFileIndex === 0}
                                className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors flex items-center text-xs"
                            >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Prev
                            </button>
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {currentFile.name} ({currentFileIndex + 1} of {files.length})
                            </span>
                            <button
                                onClick={goToNextFile}
                                disabled={currentFileIndex === files.length - 1}
                                className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors flex items-center text-xs"
                            >
                                Next
                                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {/* Right section (1/5) - Annotation and Zoom controls */}
                        <div className="w-1/5 flex justify-end gap-1.5">
                            {/* Annotation Button */}
                            <button
                                onClick={() => setIsAnnotationMode(!isAnnotationMode)}
                                className={`px-2 py-1 rounded transition-colors flex items-center justify-center ${
                                    isAnnotationMode
                                        ? "bg-blue-500 text-white hover:bg-blue-600"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                                }`}
                                title={isAnnotationMode ? "Exit Annotation Mode" : "Annotation Mode"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16"/>
                                    <path d="M15.697 14h5.606"/>
                                    <path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16"/>
                                    <path d="M3.304 13h6.392"/>
                                </svg>
                            </button>
                            
                            {/* Zoom Controls */}
                            <div className="flex items-stretch bg-gray-200 dark:bg-gray-700 rounded overflow-hidden text-xs">
                                <button
                                    onClick={zoomOut}
                                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors border-r border-gray-300 dark:border-gray-600"
                                    title="Zoom Out"
                                >
                                    -
                                </button>
                                <button
                                    onClick={resetZoom}
                                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-[10px] text-gray-800 dark:text-gray-200 transition-colors border-r border-gray-300 dark:border-gray-600"
                                    title="Reset Zoom"
                                >
                                    {Math.round(scale * 100)}%
                                </button>
                                <button
                                    onClick={zoomIn}
                                    className="px-2 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                                    title="Zoom In"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Screenshot Instructions */}
                {showScreenshotBanner && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 text-center relative">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            Click and drag on the PDF to screenshot
                        </p>
                        <button
                            onClick={() => setShowScreenshotBanner(false)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                            title="Hide instructions"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* PDF Display */}
                <div
                    id="pdf-viewer-container"
                    className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 p-4 transition-colors duration-300 relative"
                >
                    {/* Annotation Overlay */}
                    <AnnotationOverlay
                        isAnnotationMode={isAnnotationMode}
                        annotations={annotations}
                        currentFileIndex={currentFileIndex}
                        onAddAnnotation={handleAddAnnotation}
                        onUpdateAnnotation={handleUpdateAnnotation}
                        onDeleteAnnotation={handleDeleteAnnotation}
                        containerId="pdf-viewer-container"
                    />

                    {currentFile.dataUrl && (
                        <div className="flex justify-center">
                            <Document
                                file={currentFile.dataUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                            >
                                <div className="space-y-4">
                                    {Array.from(
                                        new Array(numPages),
                                        (_, index) => (
                                            <Page
                                                key={`page_${index + 1}`}
                                                pageNumber={index + 1}
                                                scale={scale}
                                                className="shadow-lg bg-white"
                                            />
                                        )
                                    )}
                                </div>
                            </Document>
                        </div>
                    )}
                </div>
            </div>

            {/* Right sidebar - Agent controls */}
            <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Clarify
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {files.length} document{files.length > 1 ? "s" : ""}{" "}
                        loaded
                    </p>
                </div>

                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {!isConnected ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Ask Clarify questions about your documents.
                            </p>

                            {/* Voice Selector */}
                            {voices.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Voice
                                    </label>
                                    <select
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {voices.map((voice) => (
                                            <option key={voice.voice_id} value={voice.voice_id}>
                                                {voice.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button
                                onClick={async () => {
                                    try {
                                        const newAgentId = await createAgent();
                                        if (newAgentId) {
                                            await startConversation(newAgentId);
                                        }
                                    } catch (error) {
                                        console.error("Failed to start:", error);
                                        alert("Failed to start Clarify. Please try again.");
                                    }
                                }}
                                disabled={isCreating || isConnected}
                                className="w-full bg-blue-500 dark:bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            >
                                {isCreating || isConnected
                                    ? "Starting..."
                                    : "Ask Clarify"}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full space-y-4">
                            {/* F Key Status Indicator */}
                            <div className={`border rounded-lg p-4 transition-colors ${
                                isFKeyHeld
                                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700'
                                    : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700'
                            }`}>
                                <p className={`text-sm font-semibold ${
                                    isFKeyHeld
                                        ? 'text-green-800 dark:text-green-300'
                                        : 'text-yellow-800 dark:text-yellow-300'
                                }`}>
                                    {isFKeyHeld
                                        ? '🎤 Listening - Ask me anything!'
                                        : '⌨️ Press F to ask Clarify something'}
                                </p>
                            </div>

                            {/* Chat History */}
                            {chatHistory.length > 0 && (
                                <div
                                    className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
                                    onClick={() => setIsChatModalOpen(true)}
                                >
                                    <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                                        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            Messages (click to expand)
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                        {chatHistory.map((msg, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex ${
                                                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                                                }`}
                                            >
                                                <div
                                                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                                                        msg.role === 'user'
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                                    }`}
                                                >
                                                    <p className="text-sm break-words">{truncateMessage(msg.content)}</p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={stopConversation}
                                className="w-full bg-red-500 dark:bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Modal */}
            {isChatModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]"
                    onClick={() => setIsChatModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg w-[600px] max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                Chat History
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsChatModalOpen(false);
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {chatHistory.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${
                                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                                >
                                    <div
                                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                                            msg.role === 'user'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                        }`}
                                    >
                                        <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                                        <p className={`text-xs mt-2 ${
                                            msg.role === 'user'
                                                ? 'text-blue-100'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                            {msg.timestamp.toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Download Annotated PDF Button */}
            {annotations.filter(a => a.fileIndex === currentFileIndex).length > 0 && (
                <button
                    onClick={downloadAnnotatedPDF}
                    disabled={isDownloading}
                    className="fixed bottom-6 right-6 z-40 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 disabled:scale-100 flex items-center justify-center group"
                    title={isDownloading ? "Downloading..." : "Download Annotated PDF"}
                >
                    {isDownloading ? (
                        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg 
                            className="w-6 h-6" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                        </svg>
                    )}
                    <span className="absolute right-full mr-3 bg-gray-800 text-white text-sm px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {isDownloading ? "Downloading..." : "Download with annotations"}
                    </span>
                </button>
            )}

        </div>
    );
}
