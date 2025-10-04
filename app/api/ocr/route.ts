import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'No image data provided' },
        { status: 400 }
      );
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Remove data URL prefix to get base64 data
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');

    // Generate detailed analysis
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/png',
        },
      },
      {
        text: `Analyze this image from a textbook or educational material. Provide a comprehensive analysis:

1. **Text Content**: Extract ALL visible text verbatim, including headings, labels, captions, and any annotations.

2. **Visual Elements**: If the image contains:
   - **Diagrams**: Describe the structure, components, connections, and relationships shown. Explain what the diagram illustrates.
   - **Graphs/Charts**: Describe axes, data trends, key points, and what the visualization represents.
   - **Tables**: Extract the complete table structure with all data.
   - **Mathematical Formulas**: Write out all equations and formulas clearly.
   - **Illustrations/Figures**: Describe what is shown and its educational purpose.

3. **Context and Meaning**: Explain what concept or topic this image is teaching or illustrating.

4. **Key Information**: Highlight the most important information or takeaways from this image.

Be thorough and detailed - this analysis will be used to help students understand the material.`,
      },
    ]);

    const text = result.response.text();

    console.log('=== GEMINI RESPONSE ===');
    console.log(text);
    console.log('======================');

    return NextResponse.json({ text });
  } catch (error) {
    console.error('OCR error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
    return NextResponse.json(
      { error: 'Failed to analyze image', details: errorMessage },
      { status: 500 }
    );
  }
}
