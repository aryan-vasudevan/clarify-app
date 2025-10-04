import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const allExtractedText: string[] = [];

    // Process each file with Gemini OCR/extraction
    for (const file of files) {
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Content = buffer.toString('base64');

        let prompt = '';
        if (file.type.startsWith('image/')) {
          prompt = 'Extract all text from this image. Return only the extracted text content, maintaining the original structure and formatting as much as possible. If there are any diagrams, charts, or visual elements, describe them briefly.';
        } else if (file.type === 'application/pdf') {
          prompt = 'Extract all text content from this PDF document. Maintain the structure and formatting. Include important headings, sections, and any key information.';
        } else {
          console.warn(`Skipping unsupported file type: ${file.type}`);
          continue;
        }

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Content,
              mimeType: file.type,
            },
          },
          prompt,
        ]);

        const response = await result.response;
        const extractedText = response.text();
        allExtractedText.push(`[From ${file.name}]\n${extractedText}`);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        allExtractedText.push(`[From ${file.name}]\nError: Could not extract text from this file.`);
      }
    }

    // Combine all extracted text
    const combinedText = allExtractedText.join('\n\n---\n\n');

    // Create a text file with all extracted content
    const textBlob = new Blob([combinedText], { type: 'text/plain' });
    
    // Upload to ElevenLabs Knowledge Base
    const kbFormData = new FormData();
    kbFormData.append('file', textBlob, 'extracted-content.txt');
    kbFormData.append('name', `Uploaded Documents (${files.length} files)`);

    const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: kbFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs API error:', error);
      return NextResponse.json(
        { error: 'Failed to create knowledge base document' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ 
      document_id: data.id, 
      name: data.name,
      filesProcessed: files.length,
    });
  } catch (error) {
    console.error('Error creating knowledge base document:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge base document' },
      { status: 500 }
    );
  }
}
