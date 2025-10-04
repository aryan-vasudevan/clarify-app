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
        name: 'Economics Tutor',
        conversation_config: {
          agent: {
            prompt: {
              prompt: `You are an economics tutor. Use the economics textbook in your knowledge base to answer student questions accurately and clearly. Provide explanations, examples, and help students understand economic concepts.`,
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
