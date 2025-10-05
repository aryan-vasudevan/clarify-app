"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const words = ["conversational", "interactive", "personalized", "intelligent", "instant"];

export default function Home() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [displayedWord, setDisplayedWord] = useState("");
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    
    useEffect(() => {
        const currentWord = words[currentWordIndex];
        
        const typingSpeed = isDeleting ? 30 : 50;
        
        const timer = setTimeout(() => {
            if (!isDeleting) {
                // Typing forward
                if (displayedWord.length < currentWord.length) {
                    setDisplayedWord(currentWord.slice(0, displayedWord.length + 1));
                } else {
                    // Finished typing, wait 3 seconds then start deleting
                    setTimeout(() => setIsDeleting(true), 3000);
                }
            } else {
                // Deleting backward
                if (displayedWord.length > 0) {
                    setDisplayedWord(displayedWord.slice(0, -1));
                } else {
                    // Finished deleting, move to next word
                    setIsDeleting(false);
                    setCurrentWordIndex((prev) => (prev + 1) % words.length);
                }
            }
        }, typingSpeed);
        
        return () => clearTimeout(timer);
    }, [displayedWord, currentWordIndex, isDeleting]);

    const handleContinue = () => {
        if (selectedFiles.length === 0) {
            alert("Please select at least one PDF file");
            return;
        }

        // Store files in sessionStorage to pass to viewer page
        const filesData = selectedFiles.map(file => ({
            name: file.name,
            type: file.type,
        }));
        sessionStorage.setItem("uploadedFiles", JSON.stringify(filesData));
        sessionStorage.setItem("fileCount", selectedFiles.length.toString());

        // Store actual file objects
        const filePromises = selectedFiles.map((file) => {
            return new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    sessionStorage.setItem(`file_${file.name}`, e.target?.result as string);
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(filePromises).then(() => {
            router.push("/viewer");
        });
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

    return (
        <div
            className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300"
            style={{ fontFamily: "var(--font-geist-mono)" }}
        >
            <div className="max-w-2xl w-full px-6">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                        Kirb
                    </h1>
                    <div className="text-gray-600 dark:text-gray-400">
                        <p className="mb-1">Upload your textbook/chapter and get help from Kirb that is</p>
                        <div className="flex items-center justify-center min-h-[32px]">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
                                {displayedWord}
                            </span>
                            <span className="inline-block w-0.5 h-5 bg-blue-600 dark:bg-blue-400 ml-0.5 animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 transition-colors duration-300">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer"
                        >
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center mb-4 transition-colors">
                                    <span className="text-3xl text-white">
                                        +
                                    </span>
                                </div>
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
                                    Upload PDF Files
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Click to browse or drag and drop
                                </p>
                            </div>
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".pdf"
                        />
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                Selected Files ({selectedFiles.length})
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            <svg
                                                className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                            </svg>
                                            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                                {file.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleFileDelete(index)}
                                            className="ml-3 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                        >
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleContinue}
                        disabled={selectedFiles.length === 0}
                        className="w-full mt-6 bg-blue-500 dark:bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        Continue to Viewer
                    </button>
                </div>
            </div>
        </div>
    );
}
