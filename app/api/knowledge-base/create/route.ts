import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
    try {
        // read econ.pdf
        const filePath = join(process.cwd(), "econ.pdf");
        const fileBuffer = await readFile(filePath);

        // Create FormData for multipart upload
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)], {
            type: "application/pdf",
        });
        formData.append("file", blob, "econ.pdf");
        formData.append("name", "Economics Textbook");

        const response = await fetch(
            "https://api.elevenlabs.io/v1/convai/knowledge-base",
            {
                method: "POST",
                headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY!,
                },
                body: formData,
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error("ElevenLabs API error:", error);
            return NextResponse.json(
                { error: "Failed to create knowledge base document" },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({ document_id: data.id, name: data.name });
    } catch (error) {
        console.error("Error creating knowledge base document:", error);
        return NextResponse.json(
            { error: "Failed to create knowledge base document" },
            { status: 500 }
        );
    }
}
