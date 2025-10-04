"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import { Conversation } from "@elevenlabs/client";
import ScreenshotButton from "../components/ScreenshotButton";
import ThemeToggle from "../components/ThemeToggle";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileData {
    name: string;
    type: string;
    dataUrl?: string;
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
    const conversationRef = useRef<any>(null);

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
        setScale((prev) => Math.min(prev + 0.2, 3.0));
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
                const fileObj = new File([blob], file.name, { type: file.type });

                const formData = new FormData();
                formData.append("file", fileObj);
                formData.append("name", file.name.replace(".pdf", ""));

                const kbResponse = await fetch("/api/knowledge-base/create", {
                    method: "POST",
                    body: formData,
                });

                if (!kbResponse.ok) {
                    throw new Error(`Failed to create knowledge base for ${file.name}`);
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
                onConnect: () => {
                    console.log("Connected to agent");
                    setIsConnected(true);
                },
                onDisconnect: () => {
                    console.log("Disconnected from agent");
                    setIsConnected(false);
                },
                onError: (error: any) => {
                    console.error("Conversation error:", error);
                },
                onMessage: (message: any) => {
                    console.log("Message from agent:", message);
                },
            });
            conversationRef.current = conversation;
        } catch (error) {
            console.error("Error starting conversation:", error);
            alert("Failed to start conversation");
        }
    };

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

    if (files.length === 0) {
        return null;
    }

    const currentFile = files[currentFileIndex];

    return (
        <div className="h-screen flex" style={{ fontFamily: "var(--font-geist-mono)" }}>
            <ScreenshotButton />
            <ThemeToggle />
            {/* Left side - PDF Viewer */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                {/* Header with file navigation */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors duration-300">
                    <div className="flex items-center justify-between">
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

                        <div className="flex items-center space-x-4">
                            <button
                                onClick={goToPrevFile}
                                disabled={currentFileIndex === 0}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors"
                            >
                                ← Prev File
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {currentFile.name} ({currentFileIndex + 1} of {files.length})
                            </span>
                            <button
                                onClick={goToNextFile}
                                disabled={currentFileIndex === files.length - 1}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors"
                            >
                                Next File →
                            </button>
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={zoomOut}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                                title="Zoom Out"
                            >
                                -
                            </button>
                            <button
                                onClick={resetZoom}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs text-gray-800 dark:text-gray-200 transition-colors"
                                title="Reset Zoom"
                            >
                                {Math.round(scale * 100)}%
                            </button>
                            <button
                                onClick={zoomIn}
                                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                                title="Zoom In"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* PDF Display */}
                <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-800 p-4 transition-colors duration-300">
                    {currentFile.dataUrl && (
                        <div className="flex justify-center">
                            <Document
                                file={currentFile.dataUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                            >
                                <div className="space-y-4">
                                    {Array.from(new Array(numPages), (_, index) => (
                                        <Page
                                            key={`page_${index + 1}`}
                                            pageNumber={index + 1}
                                            scale={scale}
                                            className="shadow-lg bg-white"
                                        />
                                    ))}
                                </div>
                            </Document>
                        </div>
                    )}
                </div>
            </div>

            {/* Right sidebar - Agent controls */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Kirb</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {files.length} document{files.length > 1 ? "s" : ""} loaded
                    </p>
                </div>

                <div className="flex-1 p-6">
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
                                {isCreating ? "Creating Agent..." : "Create Agent"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
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
                                            🎤 Conversation active - speak to your tutor!
                                        </p>
                                    </div>
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
        </div>
    );
}
