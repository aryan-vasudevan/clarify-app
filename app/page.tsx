"use client";

import { useEffect, useState } from "react";

export default function Home() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const handleFilesSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        // use selectedFiles with gemini code here
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
            <form onSubmit={handleFilesSubmit} className="h-full w-full">
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
                        <button
                            type="submit"
                            className="text-blue-500 bg-white border-blue-500 border-2 hover:text-white hover:bg-blue-500 px-2 rounded-lg h-full hover:cursor-pointer transition-all duration-100 font-normal"
                        >
                            Submit
                        </button>
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
            </form>
        </div>
    );
}
