import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Perform OCR with Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: file.type,
        },
      },
      'Extract all text from this image. Return only the extracted text content, maintaining the original structure and formatting as much as possible. If there are any diagrams, charts, or visual elements, describe them briefly.',
    ]);

    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      text,
      filename: file.name,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Error performing OCR:', error);
    return NextResponse.json(
      { error: 'Failed to perform OCR on image' },
      { status: 500 }
    );
  }
}

