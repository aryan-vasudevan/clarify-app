import { Fira_Code } from 'next/font/google';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { knowledgeBaseIds, fileNames } = await request.json();

    const agentName = fileNames && fileNames.length > 0
      ? `${fileNames.length === 1 ? fileNames[0] : 'Multi-Document'} Tutor`
      : 'Document Tutor';

    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentName,
        conversation_config: {
          agent: {
            first_message: "Hello! I'm Kirb, your AI tutor. I'm here to help you understand any diagrams or concepts from your textbook. Feel free to ask me any questions or highlight a diagram for me to explain!",
            prompt: {
              prompt: `You are a helpful tutor. Use the ${fileNames && fileNames.length > 0 ? 'documents' : 'material'} in your knowledge base to answer student questions accurately and clearly. Provide explanations, examples, and help students understand the concepts from the provided material.

IMPORTANT BEHAVIOR RULES:
- NEVER ask "Are you still there?" or check in proactively
- ONLY speak when the user asks you a question or sends you information
- If the user says they'll let you know if they need help, simply acknowledge and then stay completely silent
- Do NOT initiate conversation or ask follow-up questions unless the user specifically asks you something
- Wait patiently for the user to speak to you`,
            },
          },
          turn: {
            turn_timeout: 30,
            mode: "silence",
          },
        },
        platform_settings: {
          knowledge_base: knowledgeBaseIds && knowledgeBaseIds.length > 0 ? knowledgeBaseIds : undefined,
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
