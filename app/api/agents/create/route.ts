import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { knowledgeBaseId } = await request.json();

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Learning Assistant',
        conversation_config: {
          agent: {
            prompt: {
              prompt: `You are an intelligent AI learning assistant. The user has uploaded documents (screenshots, PDFs, or images) to your knowledge base.

Your role is to:
1. Answer questions about the content naturally and conversationally
2. When the user asks "What does this mean?" or "Explain this" without specifying what, understand they're referring to the most relevant or important concept from the uploaded content
3. Provide clear, concise explanations suitable for learning
4. Use the knowledge base to give accurate, contextual answers
5. Be friendly and encouraging, making complex topics easier to understand
6. When appropriate, break down explanations into simple steps or bullet points

Remember: The user is looking at their documents while talking to you, so contextual questions like "what does this mean?" refer to the content they've shared with you. Use your knowledge base to provide accurate, helpful answers.`,
            },
          },
        },
        platform_settings: {
          knowledge_base: knowledgeBaseId ? [knowledgeBaseId] : undefined,
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
