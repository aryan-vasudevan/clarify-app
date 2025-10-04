import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let extractedText = '';

    // Handle images with OCR
    if (file.type.startsWith('image/')) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64Image = buffer.toString('base64');

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
      extractedText = response.text();
    } 
    // Handle PDFs with text extraction
    else if (file.type === 'application/pdf') {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64Pdf = buffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Pdf,
            mimeType: 'application/pdf',
          },
        },
        'Extract all text content from this PDF document. Maintain the structure and formatting. Include important headings, sections, and any key information.',
      ]);

      const response = await result.response;
      extractedText = response.text();
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    return NextResponse.json({ 
      text: extractedText,
      filename: file.name,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}

