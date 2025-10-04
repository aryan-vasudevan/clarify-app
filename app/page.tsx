"use client";

import { useEffect, useState, useRef } from "react";
import { Conversation } from "@elevenlabs/client";

export default function Home() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [agentId, setAgentId] = useState<string | null>(null);
    const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const conversationRef = useRef<any>(null);

    const createAgent = async () => {
        setIsCreating(true);
        try {
            if (selectedFiles.length === 0) {
                alert("Please select at least one PDF file");
                setIsCreating(false);
                return;
            }

            // Upload all PDFs to knowledge base
            const documentIds: string[] = [];
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append("file", file);
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

            setKnowledgeBaseId(documentIds.join(","));

            const agentResponse = await fetch("/api/agents/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    knowledgeBaseIds: documentIds,
                    fileNames: selectedFiles.map(f => f.name.replace(".pdf", "")),
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

            if (knowledgeBaseId) {
                const documentIds = knowledgeBaseId.split(",");
                for (const docId of documentIds) {
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

                setKnowledgeBaseId(null);
            }

            setIsConnected(false);
        } catch (error) {
            console.error("Error stopping conversation:", error);
            alert("Failed to stop conversation");
        }
    };

    const handleFilesSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        console.log("Submitted files:", selectedFiles);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        setSelectedFiles([...selectedFiles, ...Array.from(event.target.files)]);
        event.target.value = "";
    };

    const handleFileDelete = (_: number) => {
        setSelectedFiles([
            ...selectedFiles.slice(0, _),
            ...selectedFiles.slice(_ + 1),
        ]);
    };

    useEffect(() => {
        console.log(selectedFiles);
    }, [selectedFiles]);

    return (
        <div
            className="min-h-screen flex flex-col justify-center place-items-center w-screen"
            style={{ fontFamily: "var(--font-geist-mono)" }}
        >
            <div className="h-full w-full">
                <div className="flex flex-col justify-center place-items-center my-4 w-full">
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
                            accept=".pdf"
                        />
                        {!agentId ? (
                            <button
                                onClick={createAgent}
                                className="text-blue-500 bg-white border-blue-500 border-2 hover:text-white hover:bg-blue-500 px-2 rounded-lg h-full hover:cursor-pointer transition-all duration-100 font-normal"
                            >
                                {isCreating
                                    ? "Creating Agent..."
                                    : "Create Agent"}
                            </button>
                        ) : (
                            <>
                                {!isConnected ? (
                                    <button
                                        onClick={startConversation}
                                        className="text-blue-500 bg-white border-blue-500 border-2 hover:text-white hover:bg-blue-500 px-2 rounded-lg h-full hover:cursor-pointer transition-all duration-100 font-normal"
                                    >
                                        Start Conversation
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopConversation}
                                        className="text-blue-500 bg-white border-blue-500 border-2 hover:text-white hover:bg-blue-500 px-2 rounded-lg h-full hover:cursor-pointer transition-all duration-100 font-normal"
                                    >
                                        Stop Conversation
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-3 w-4/5 px-4 py-2 border-gray-600 border-[1px] rounded-b-xl border-t-transparent overflow-y-scroll h-24">
                        {selectedFiles.length > 0 ? (
                            selectedFiles.map((file, _) => (
                                <div
                                    key={_}
                                    className="font-bold gap-x-2 opacity-80 hover:opacity-100 row-span-1 grid grid-cols-4 h-fit"
                                >
                                    <div className="col-span-3 truncate">
                                        {file.name}
                                    </div>
                                    <button
                                        className="hover:cursor-pointer"
                                        onClick={() => handleFileDelete(_)}
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
                                icon (.pdf only)
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
