"use client";

import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="fixed top-6 right-6 z-50 w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:scale-110 transition-all duration-300 shadow-lg"
            aria-label="Toggle theme"
        >
            <div className="relative w-6 h-6">
                {/* Sun icon */}
                <svg
                    className={`absolute inset-0 w-6 h-6 text-yellow-500 transition-all duration-500 ${
                        isDark
                            ? "rotate-90 scale-0 opacity-0"
                            : "rotate-0 scale-100 opacity-100"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>

                {/* Moon icon */}
                <svg
                    className={`absolute inset-0 w-6 h-6 text-blue-300 transition-all duration-500 ${
                        isDark
                            ? "rotate-0 scale-100 opacity-100"
                            : "-rotate-90 scale-0 opacity-0"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                </svg>
            </div>
        </button>
    );
}
