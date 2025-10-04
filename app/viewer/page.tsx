"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Conversation } from "@elevenlabs/client";
import ScreenshotArea from "../components/ScreenshotButton";
import ThemeToggle from "../components/ThemeToggle";

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
    }, [router]);

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
                }),
            });

            if (!agentResponse.ok) {
                throw new Error("Failed to create agent");
            }

            const agentData = await agentResponse.json();
            setAgentId(agentData.agent_id);
        } catch (error) {
            console.error("Error creating agent:", error);
            alert("Failed to create agent");
        } finally {
            setIsCreating(false);
        }
    };

    const startConversation = async () => {
        if (!agentId) return;

        try {
            const conversation = await Conversation.startSession({
                agentId: agentId,
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
                    console.log("Message from agent:", message);
                    // Only add to chat history if there's actual text content
                    if (message.message && message.message.trim().length > 0) {
                        setChatHistory(prev => {
                            const lastMsg = prev[prev.length - 1];
                            // If last message was from agent, append to it
                            if (lastMsg && lastMsg.role === 'agent') {
                                return [
                                    ...prev.slice(0, -1),
                                    {
                                        ...lastMsg,
                                        content: lastMsg.content + ' ' + message.message,
                                        timestamp: new Date()
                                    }
                                ];
                            }
                            // Otherwise create new message
                            return [...prev, {
                                role: 'agent',
                                content: message.message,
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
            console.log(conversationRef);
        } catch (error) {
            console.error("Error starting conversation:", error);
            alert("Failed to start conversation");
        }
    };

    // Auto-scroll to latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // Listen for screenshot events and send to conversation
    useEffect(() => {
        const handleScreenshotProcessing = () => {
            if (!conversationRef.current || !isConnected) {
                console.log(
                    "Screenshot being processed but conversation not active"
                );
                return;
            }

            // Send an immediate acknowledgment message
            const acknowledgment =
                "Wait while I process the diagram, I'll be able to explain it shortly.";

            try {
                conversationRef.current.sendUserMessage(acknowledgment);
            } catch (error) {
                console.error("Failed to send acknowledgment:", error);
            }
        };

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
                            content: lastMsg.content + ', sent a diagram or something',
                            timestamp: new Date()
                        }
                    ];
                }
                // Otherwise create new message
                return [...prev, {
                    role: 'user',
                    content: 'sent a diagram or something',
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
            "screenshotProcessing",
            handleScreenshotProcessing as EventListener
        );
        window.addEventListener(
            "newScreenshot",
            handleNewScreenshot as EventListener
        );

        return () => {
            window.removeEventListener(
                "screenshotProcessing",
                handleScreenshotProcessing as EventListener
            );
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
            <ScreenshotArea containerId="pdf-viewer-container" />
            <ThemeToggle />
            {/* Left side - PDF Viewer */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                {/* Header with file navigation */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
                    <div className="flex items-center">
                        {/* Left section (1/5) - Back button */}
                        <div className="w-1/5 flex justify-start">
                            <button
                                onClick={() => router.push("/")}
                                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 flex items-center transition-colors"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
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
                        <div className="w-3/5 flex items-center justify-center space-x-4">
                            <button
                                onClick={goToPrevFile}
                                disabled={currentFileIndex === 0}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors"
                            >
                                ← Prev File
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {currentFile.name} ({currentFileIndex + 1} of{" "}
                                {files.length})
                            </span>
                            <button
                                onClick={goToNextFile}
                                disabled={currentFileIndex === files.length - 1}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors"
                            >
                                Next File →
                            </button>
                        </div>

                        {/* Right section (1/5) - Zoom controls as one box */}
                        <div className="w-1/5 flex justify-end">
                            <div className="flex items-stretch bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                                <button
                                    onClick={zoomOut}
                                    className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors border-r border-gray-300 dark:border-gray-600"
                                    title="Zoom Out"
                                >
                                    -
                                </button>
                                <button
                                    onClick={resetZoom}
                                    className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs text-gray-800 dark:text-gray-200 transition-colors border-r border-gray-300 dark:border-gray-600"
                                    title="Reset Zoom"
                                >
                                    {Math.round(scale * 100)}%
                                </button>
                                <button
                                    onClick={zoomIn}
                                    className="px-3 py-1 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
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
                            Click and drag on the PDF to screenshot • Press ESC to
                            cancel
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
                    className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 p-4 transition-colors duration-300"
                >
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
                        Kirb
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {files.length} document{files.length > 1 ? "s" : ""}{" "}
                        loaded
                    </p>
                </div>

                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {!agentId ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Initiate a conversational chat with Kirb.
                            </p>
                            <button
                                onClick={createAgent}
                                disabled={isCreating}
                                className="w-full bg-blue-500 dark:bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                            >
                                {isCreating
                                    ? "Creating Agent..."
                                    : "Create Agent"}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                                <p className="text-sm text-green-800 dark:text-green-300">
                                    ✓ Agent created successfully!
                                </p>
                            </div>

                            {!isConnected ? (
                                <button
                                    onClick={startConversation}
                                    className="w-full bg-green-500 dark:bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
                                >
                                    Start Conversation
                                </button>
                            ) : (
                                <>
                                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                                        <p className="text-sm text-blue-800 dark:text-blue-300">
                                            🎤 Conversation active - speak to
                                            your tutor!
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
                                        Stop Conversation
                                    </button>
                                </>
                            )}
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

        </div>
    );
}
