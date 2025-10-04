This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# AI Screenshot Assistant

An intelligent voice-based assistant that helps you understand content from screenshots using OCR and conversational AI.

## Features

- 📸 **Screenshot Upload**: Upload one or multiple screenshots/images
- 🔍 **Smart OCR**: Automatic text extraction using Google Gemini AI (saves storage and processing time)
- 🎙️ **Voice Conversations**: Talk naturally with the AI about your screenshots using ElevenLabs
- 💬 **Context-Aware Q&A**: Ask questions like "What does this mean?" without needing to be specific
- 🖼️ **Image Preview**: See your uploaded screenshots before creating the agent

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your API keys:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How to Use

1. **Upload Screenshots**: Click the upload area and select one or more screenshots
2. **Wait for OCR**: The app will automatically extract text from your images using Gemini
3. **Create Agent**: Click "Create Agent & Start Chat" to create your AI assistant
4. **Start Conversation**: Begin a voice conversation with the AI
5. **Ask Questions**: Simply say things like:
   - "What does this mean?"
   - "Explain this concept"
   - "Can you help me understand this?"

The AI understands contextual questions, so you don't need to be specific about what "this" refers to!

## Technology Stack

- **Next.js 15** - React framework
- **ElevenLabs** - Voice conversation AI
- **Google Gemini** - OCR and text extraction
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
