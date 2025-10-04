import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { textContent } = await request.json();

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Screenshot Assistant',
        conversation_config: {
          agent: {
            prompt: {
              prompt: `You are an intelligent AI assistant specialized in explaining content from screenshots and images. The user has uploaded screenshots containing the following content:

${textContent || 'No content available.'}

Your role is to:
1. Answer questions about this content naturally and conversationally
2. When the user asks "What does this mean?" or "Explain this" without specifying what, understand they're referring to the most relevant or important concept from the uploaded content
3. Provide clear, concise explanations suitable for learning
4. If asked about something not in the content, politely indicate you can only discuss what's shown in the uploaded screenshots
5. Be friendly and encouraging, making complex topics easier to understand
6. When appropriate, break down explanations into simple steps or bullet points

Remember: The user is looking at their screenshots while talking to you, so contextual questions like "what does this mean?" refer to the content they've shared with you.`,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs API error:', error);
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ agent_id: data.agent_id });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
