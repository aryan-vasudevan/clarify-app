import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const formDataRequest = await request.formData();
        const file = formDataRequest.get("file") as File;
        const name = formDataRequest.get("name") as string;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name || file.name);

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
