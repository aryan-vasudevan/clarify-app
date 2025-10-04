"use client";

import { useEffect, useState, useRef } from "react";
import { Conversation } from "@elevenlabs/client";

export default function Home() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [agentId, setAgentId] = useState<string | null>(null);
    const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const conversationRef = useRef<any>(null);

    const handleFilesSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (selectedFiles.length === 0) {
            alert("Please select at least one file!");
            return;
        }

        setIsProcessing(true);
        try {
            // Process files with Gemini (OCR for images, text extraction for PDFs)
            const formData = new FormData();
            selectedFiles.forEach((file) => {
                formData.append('files', file);
            });

            // Create knowledge base with processed files
            const kbResponse = await fetch('/api/knowledge-base/create', {
                method: 'POST',
                body: formData,
            });

            if (!kbResponse.ok) {
                throw new Error('Failed to create knowledge base');
            }

            const kbData = await kbResponse.json();
            setKnowledgeBaseId(kbData.document_id);

            // Create agent with knowledge base
            const agentResponse = await fetch('/api/agents/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    knowledgeBaseId: kbData.document_id,
                }),
            });

            if (!agentResponse.ok) {
                throw new Error('Failed to create agent');
            }

            const agentData = await agentResponse.json();
            setAgentId(agentData.agent_id);
            
            alert('Agent created successfully! You can now start a conversation.');
        } catch (error) {
            console.error('Error processing files:', error);
            alert('Failed to process files and create agent');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        setSelectedFiles([...selectedFiles, ...Array.from(event.target.files)]);
        event.target.value = "";
    };

    const handleFileDelete = (index: number) => {
        setSelectedFiles([
            ...selectedFiles.slice(0, index),
            ...selectedFiles.slice(index + 1),
        ]);
    };

    const startConversation = async () => {
        if (!agentId) return;

        setIsCreating(true);
        try {
            const conversation = await Conversation.startSession({
                agentId: agentId,
                connectionType: 'webrtc',
                onConnect: () => {
                    console.log('Connected to agent');
                    setIsConnected(true);
                },
                onDisconnect: () => {
                    console.log('Disconnected from agent');
                    setIsConnected(false);
                },
                onError: (error: any) => {
                    console.error('Conversation error:', error);
                },
                onMessage: (message: any) => {
                    console.log('Message from agent:', message);
                },
            });

            conversationRef.current = conversation;
        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('Failed to start conversation');
        } finally {
            setIsCreating(false);
        }
    };

    const stopConversation = async () => {
        try {
            // End the conversation session
            if (conversationRef.current) {
                await conversationRef.current.endSession();
                conversationRef.current = null;
            }

            // Delete the agent
            if (agentId) {
                const agentResponse = await fetch('/api/agents/delete', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        agent_id: agentId,
                    }),
                });

                if (!agentResponse.ok) {
                    throw new Error('Failed to delete agent');
                }

                setAgentId(null);
            }

            // Delete the knowledge base document
            if (knowledgeBaseId) {
                const kbResponse = await fetch('/api/knowledge-base/delete', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        document_id: knowledgeBaseId,
                    }),
                });

                if (!kbResponse.ok) {
                    throw new Error('Failed to delete knowledge base');
                }

                setKnowledgeBaseId(null);
            }

            setIsConnected(false);
            setSelectedFiles([]);
        } catch (error) {
            console.error('Error stopping conversation:', error);
            alert('Failed to stop conversation');
        }
    };

    useEffect(() => {
        console.log(selectedFiles);
    }, [selectedFiles]);

    return (
        <div
            className="min-h-screen flex flex-col justify-center place-items-center w-screen"
            style={{ fontFamily: "var(--font-geist-mono)" }}
        >
            {!agentId ? (
                <form onSubmit={handleFilesSubmit} className="h-full w-full">
                    <div className="flex flex-col justify-center place-items-center my-4 w-full">
                        <div className="mb-4 text-center">
                            <h1 className="text-2xl font-bold mb-2">AI Learning Assistant</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Upload screenshots or PDFs and ask contextual questions like &quot;What does this mean?&quot;
                            </p>
                        </div>
                        <div className="flex justify-between h-12 px-4 py-2 w-4/5 border-gray-600 border-[1px] rounded-t-xl">
                            <label
                                htmlFor="file-upload"
                                className="text-center border-2 border-blue-500 font-bold text-blue-500 hover:text-white bg-white hover:bg-blue-500 w-8 h-8 content-center rounded-lg cursor-pointer transition-all duration-100"
                            >
                                +
                            </label>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                                accept="image/*,.pdf"
                            />
                            <button
                                type="submit"
                                disabled={isProcessing || selectedFiles.length === 0}
                                className="text-blue-500 bg-white border-blue-500 border-2 hover:text-white hover:bg-blue-500 px-2 rounded-lg h-full hover:cursor-pointer transition-all duration-100 font-normal disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? 'Processing...' : 'Submit & Create Agent'}
                            </button>
                        </div>
                        <div className="grid grid-cols-3 w-4/5 px-4 py-2 border-gray-600 border-[1px] rounded-b-xl border-t-transparent overflow-y-scroll h-24">
                            {selectedFiles.length > 0 ? (
                                selectedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="font-bold gap-x-2 opacity-80 hover:opacity-100 row-span-1 grid grid-cols-4 h-fit"
                                    >
                                        <div className="col-span-3 truncate">
                                            {file.name}
                                        </div>
                                        <button
                                            type="button"
                                            className="hover:cursor-pointer"
                                            onClick={() => handleFileDelete(index)}
                                        >
                                            ❌
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-3">
                                    Add files using the{" "}
                                    <span className="font-semibold text-blue-500">
                                        +
                                    </span>{" "}
                                    icon (images & PDFs)
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    {!isConnected ? (
                        <>
                            <div className="text-center mb-4">
                                <p className="text-lg font-medium mb-2">Agent Ready!</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Ask questions like: &quot;What does this mean?&quot; or &quot;Explain this concept&quot;
                                </p>
                            </div>
                            <button
                                onClick={startConversation}
                                disabled={isCreating}
                                className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-green-600 text-white gap-2 hover:bg-green-700 font-medium text-sm sm:text-base h-12 px-6 disabled:opacity-50"
                            >
                                {isCreating ? 'Connecting...' : 'Start Voice Conversation'}
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-green-600 font-medium text-xl">🎙️ Connected - Speak now!</div>
                            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                                <p>Try asking: &quot;What does this mean?&quot; or &quot;Explain this to me&quot;</p>
                            </div>
                            <button
                                onClick={stopConversation}
                                className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-600 text-white gap-2 hover:bg-red-700 font-medium text-sm sm:text-base h-12 px-6"
                            >
                                Stop & Delete Agent
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
