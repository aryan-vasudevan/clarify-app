"use client"
import { useState, useRef } from "react";
import { Conversation } from "@elevenlabs/client";

export default function Home() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const conversationRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingOCR(true);
    const allExtractedText: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Create preview for the last image
        if (i === files.length - 1) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        }

        // Process OCR
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to process image');
        }

        const data = await response.json();
        allExtractedText.push(`[From ${data.filename}]\n${data.text}`);
      }

      const combinedText = allExtractedText.join('\n\n');
      setExtractedText(prev => prev ? `${prev}\n\n${combinedText}` : combinedText);
      setUploadedImages(prev => [...prev, ...Array.from(files).map(f => f.name)]);
      
      alert(`Successfully extracted text from ${files.length} image(s)!`);
    } catch (error) {
      console.error('Error processing images:', error);
      alert('Failed to process images');
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const createAgent = async () => {
    if (!extractedText) {
      alert('Please upload at least one screenshot first!');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/agents/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textContent: extractedText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create agent');
      }

      const data = await response.json();
      setAgentId(data.agent_id);
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
        const response = await fetch('/api/agents/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: agentId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete agent');
        }

        setAgentId(null);
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error stopping conversation:', error);
      alert('Failed to stop conversation');
    }
  };

  const resetSession = () => {
    setExtractedText('');
    setUploadedImages([]);
    setImagePreview(null);
    setAgentId(null);
    setIsConnected(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-center mb-8">AI Screenshot Assistant</h1>
        
        {!agentId ? (
          <div className="flex flex-col items-center gap-6">
            {/* Upload Section */}
            <div className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-lg font-medium">
                  {isProcessingOCR ? 'Processing...' : 'Click to upload screenshots'}
                </span>
                <span className="text-sm text-gray-500">
                  Supports multiple images (PNG, JPG, etc.)
                </span>
              </label>
            </div>

            {/* Preview and Info */}
            {(imagePreview || uploadedImages.length > 0) && (
              <div className="w-full flex flex-col gap-4">
                {imagePreview && (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-96 object-contain" />
                  </div>
                )}
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <p className="font-medium mb-2">Uploaded Images ({uploadedImages.length}):</p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {uploadedImages.map((name, idx) => (
                      <li key={idx}>{name}</li>
                    ))}
                  </ul>
                </div>

                {extractedText && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <p className="font-medium mb-2">Extracted Text Preview:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {extractedText.slice(0, 500)}
                      {extractedText.length > 500 && '...'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={createAgent}
                disabled={isCreating || !extractedText || isProcessingOCR}
                className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue-600 text-white gap-2 hover:bg-blue-700 font-medium text-sm sm:text-base h-12 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating Agent...' : 'Create Agent & Start Chat'}
              </button>
              
              {extractedText && (
                <button
                  onClick={resetSession}
                  className="rounded-full border border-solid border-gray-300 dark:border-gray-600 transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-sm sm:text-base h-12 px-8"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {!isConnected ? (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-4">
                  <p className="text-lg font-medium mb-2">Agent Ready!</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ask questions like: &quot;What does this mean?&quot; or &quot;Explain this concept&quot;
                  </p>
                </div>
                <button
                  onClick={startConversation}
                  className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-green-600 text-white gap-2 hover:bg-green-700 font-medium text-sm sm:text-base h-12 px-8"
                >
                  Start Voice Conversation
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="text-green-600 font-medium text-xl">🎙️ Connected - Speak now!</div>
                <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <p>Try asking: &quot;What does this mean?&quot; or &quot;Explain this to me&quot;</p>
                </div>
                <button
                  onClick={stopConversation}
                  className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-600 text-white gap-2 hover:bg-red-700 font-medium text-sm sm:text-base h-12 px-8"
                >
                  Stop & Delete Agent
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
