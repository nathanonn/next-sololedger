---
name: ai-sdk-v5
description: Build AI-native applications with AI SDK v5. Use when integrating LLMs (OpenAI, Anthropic, Gemini) for text generation, streaming, structured outputs, embeddings, image generation, or audio processing. Covers setup, core workflows, provider selection, and advanced features like reasoning, caching, and tool usage.
---

# AI SDK v5

Build AI-native applications faster with standardized AI model integrations across OpenAI, Anthropic, and Google Generative AI (Gemini).

## Quick Start

### Installation

```bash
# Install the core AI SDK
npm install ai

# Install provider(s) you need
npm install @ai-sdk/openai      # OpenAI
npm install @ai-sdk/anthropic   # Anthropic
npm install @ai-sdk/google      # Google Generative AI
```

### Environment Variables

```bash
# .env file
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Basic Setup

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// OpenAI
const openaiModel = openai('gpt-5');

// Anthropic
const anthropicModel = anthropic('claude-sonnet-4-20250514');

// Google Gemini
const googleModel = google('gemini-2.5-flash');

const { text } = await generateText({
  model: openaiModel,
  prompt: 'Explain quantum computing in simple terms.',
});
```

## Core Workflows

### 1. Text Generation

Generate text from a single prompt:

```typescript
import { generateText } from 'ai';

const { text, finishReason, usage } = await generateText({
  model: openai('gpt-5'),
  prompt: 'Write a haiku about coding.',
  temperature: 0.7,
  maxTokens: 100,
});

console.log(text);
console.log('Finish reason:', finishReason);
console.log('Tokens used:', usage.totalTokens);
```

### 2. Streaming Text

Stream text for real-time display:

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Explain the theory of relativity.',
});

// Stream the text
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}

// Or get full text when done
const fullText = await result.text;
```

### 3. Structured Output (JSON)

Generate structured data that matches a schema:

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()),
      cookingTime: z.number(),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

console.log(object.recipe.name);
console.log(object.recipe.ingredients);
```

### 4. Streaming Structured Output

Stream structured data incrementally:

```typescript
import { streamObject } from 'ai';
import { z } from 'zod';

const result = streamObject({
  model: openai('gpt-5'),
  schema: z.object({
    characters: z.array(
      z.object({
        name: z.string(),
        class: z.string(),
        description: z.string(),
      }),
    ),
  }),
  prompt: 'Generate 5 fantasy RPG characters.',
});

// Stream partial objects as they arrive
for await (const partialObject of result.partialObjectStream) {
  console.log(partialObject);
}
```

### 5. Multi-turn Conversations

Build conversational applications:

```typescript
const { text, messages } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'How do I reverse a string in Python?' },
    {
      role: 'assistant',
      content: 'You can use string slicing: `reversed = text[::-1]`',
    },
    { role: 'user', content: 'Can you show me with error handling?' },
  ],
});
```

### 6. Tool/Function Calling

Let models use tools to perform actions:

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-5'),
  tools: {
    weather: tool({
      description: 'Get weather for a location',
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        // Call weather API
        return { temperature: 72, condition: 'sunny' };
      },
    }),
  },
  prompt: "What's the weather in San Francisco?",
  maxSteps: 5, // Allow multiple tool calls
});

console.log(result.text);
console.log('Tool calls:', result.toolCalls);
console.log('Tool results:', result.toolResults);
```

### 7. Multi-modal Inputs

Include images and files in prompts:

```typescript
import fs from 'fs';

const { text } = await generateText({
  model: google('gemini-2.5-flash'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'image',
          image: fs.readFileSync('./photo.jpg'),
        },
      ],
    },
  ],
});
```

### 8. Embeddings

Generate vector embeddings for semantic search:

```typescript
import { embed, embedMany } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: openai.textEmbedding('text-embedding-3-large'),
  value: 'The quick brown fox jumps over the lazy dog.',
});

// Batch embeddings
const { embeddings } = await embedMany({
  model: google.textEmbedding('gemini-embedding-001'),
  values: ['Document 1', 'Document 2', 'Document 3'],
});
```

## Choosing a Provider

| Feature | OpenAI | Anthropic | Google Gemini |
|---------|--------|-----------|---------------|
| **Best For** | General purpose, reasoning | Long context, analysis | Multimodal, search |
| **Context Window** | Up to 128K | Up to 200K | Up to 2M |
| **Reasoning** | o-series models | Extended thinking | Thinking config |
| **Caching** | Prompt cache | Prompt cache | Auto + explicit |
| **Web Search** | ✗ | Built-in tool | Built-in tool |
| **Code Execution** | ✗ | Built-in tool | Built-in tool |
| **File Support** | Images | Images, PDFs | Images, PDFs, YouTube |
| **Cost** | Moderate | Moderate-High | Low-Moderate |

### When to Use Each Provider

**OpenAI**:
- General-purpose text generation
- Complex reasoning (o-series models)
- Image generation (DALL-E)
- Audio transcription/synthesis
- Cost-optimized with flex tier

**Anthropic**:
- Long documents (200K context)
- Extended reasoning tasks
- Built-in web search needed
- Document processing (PPTX, DOCX, PDF, XLSX skills)
- Code execution in sandbox

**Google Gemini**:
- Multimodal applications
- YouTube video analysis
- Web search with grounding
- Large context (2M tokens)
- Cost-sensitive applications
- URL context analysis (up to 20 URLs)

## Common Patterns

### Error Handling

```typescript
import { APICallError } from 'ai';

try {
  const result = await generateText({
    model: openai('gpt-5'),
    prompt: 'Hello!',
  });
} catch (error) {
  if (error instanceof APICallError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.statusCode);
    console.error('Response:', error.responseBody);
  }
}
```

### Abort Controllers

Cancel long-running requests:

```typescript
const abortController = new AbortController();

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Write a long essay...',
  abortSignal: abortController.signal,
});

// Cancel after 5 seconds
setTimeout(() => abortController.abort(), 5000);
```

### Custom Headers

```typescript
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },
  prompt: 'Hello!',
});
```

### Provider Options

Each provider has specific options:

```typescript
// OpenAI
providerOptions: {
  openai: {
    reasoningEffort: 'high',
    serviceTier: 'flex', // 50% cheaper
  },
}

// Anthropic
providerOptions: {
  anthropic: {
    thinking: { type: 'enabled', budgetTokens: 12000 },
    cacheControl: { type: 'ephemeral' },
  },
}

// Google
providerOptions: {
  google: {
    thinkingConfig: { thinkingBudget: 8192, includeThoughts: true },
    safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }],
  },
}
```

## Advanced Features by Provider

### OpenAI
- Responses API (default in v5)
- Reasoning models (o-series)
- Service tiers (flex for 50% savings)
- Image generation (DALL-E)
- Audio (Whisper, TTS)

### Anthropic
- Extended thinking/reasoning
- Prompt caching (75% off)
- Web search tool
- Code execution tool
- Agent skills (PPTX, DOCX, PDF, XLSX)
- PDF support

### Google Gemini
- Thinking process
- Implicit + explicit caching
- Google Search grounding
- URL context (20 URLs)
- Code execution
- YouTube video support
- Image generation (Gemini 2.5 Flash Image)

## Next Steps

For detailed provider-specific documentation, see:
- [OpenAI Reference](references/openai.md) - Models, options, embeddings, images, audio
- [Anthropic Reference](references/anthropic.md) - Reasoning, caching, tools, skills, PDFs
- [Google Reference](references/google.md) - Thinking, caching, search, URL context, files

## Common Tasks

### Chat Application

```typescript
import { streamText } from 'ai';

async function chat(messages: Message[]) {
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    maxSteps: 5, // Enable tool usage
  });

  return result.textStream;
}
```

### RAG (Retrieval Augmented Generation)

```typescript
// 1. Generate embeddings for documents
const { embeddings } = await embedMany({
  model: openai.textEmbedding('text-embedding-3-large'),
  values: documents,
});

// 2. Store in vector DB (Pinecone, Weaviate, etc.)
// 3. Search for relevant docs
// 4. Generate answer with context

const { text } = await generateText({
  model: openai('gpt-5'),
  messages: [
    {
      role: 'system',
      content: `Context: ${relevantDocs.join('\n\n')}`,
    },
    {
      role: 'user',
      content: userQuestion,
    },
  ],
});
```

### Data Extraction

```typescript
const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: z.object({
    entities: z.array(
      z.object({
        name: z.string(),
        type: z.enum(['person', 'organization', 'location']),
        mentions: z.number(),
      }),
    ),
  }),
  prompt: `Extract named entities from: ${text}`,
});
```

### Agent with Tools

```typescript
const result = await generateText({
  model: openai('gpt-5'),
  tools: {
    searchWeb: webSearchTool,
    readFile: fileReadTool,
    writeFile: fileWriteTool,
    executeCode: codeExecutionTool,
  },
  prompt: 'Research AI trends and create a summary report.',
  maxSteps: 10,
});
```
