"use client"
import { useState, useRef } from "react";
import { Conversation } from "@elevenlabs/client";

export default function Home() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const conversationRef = useRef<any>(null);

  const createAgent = async () => {
    setIsCreating(true);
    try {
      // First, upload the economics textbook to knowledge base
      const kbResponse = await fetch('/api/knowledge-base/create', {
        method: 'POST',
      });

      if (!kbResponse.ok) {
        throw new Error('Failed to create knowledge base');
      }

      const kbData = await kbResponse.json();
      setKnowledgeBaseId(kbData.document_id);

      // Then, create the agent with the knowledge base
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
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  const startConversation = async () => {
    if (!agentId) return;

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
    } catch (error) {
      console.error('Error stopping conversation:', error);
      alert('Failed to stop conversation');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {!agentId ? (
        <button
          onClick={createAgent}
          disabled={isCreating}
          className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-12 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating Agent...' : 'Create Agent'}
        </button>
      ) : (
        <>
          {!isConnected ? (
            <button
              onClick={startConversation}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-green-600 text-white gap-2 hover:bg-green-700 font-medium text-sm sm:text-base h-12 px-6"
            >
              Start Conversation
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="text-green-600 font-medium">Connected - Speak now!</div>
              <button
                onClick={stopConversation}
                className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-600 text-white gap-2 hover:bg-red-700 font-medium text-sm sm:text-base h-12 px-6"
              >
                Stop Conversation & Delete Agent
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
