"use client"
import { useState } from "react";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayAudio = async () => {
    setIsPlaying(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'The first move is what sets everything in motion.',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <button
        onClick={handlePlayAudio}
        disabled={isPlaying}
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-12 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlaying ? 'Playing...' : 'Play Audio'}
      </button>
    </div>
  );
}
