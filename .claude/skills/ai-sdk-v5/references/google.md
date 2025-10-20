# Google Generative AI (Gemini) Provider Reference

## Installation

```bash
npm install @ai-sdk/google
```

## Setup

```typescript
import { google } from '@ai-sdk/google';

// Default instance
const model = google('gemini-2.5-flash');

// Custom instance
import { createGoogleGenerativeAI } from '@ai-sdk/google';
const customGoogle = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
});
```

## Language Models

### Basic Usage

```typescript
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const { text } = await generateText({
  model: google('gemini-2.5-flash'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Provider Options

```typescript
const model = google('gemini-2.5-flash');

await generateText({
  model,
  providerOptions: {
    google: {
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
      thinkingConfig: {
        thinkingBudget: 8192,
        includeThoughts: true,
      },
      structuredOutputs: true,
      cachedContent: 'cachedContents/{id}',
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '16:9' },
    },
  },
});
```

## Advanced Features

### Thinking Process

Gemini 2.5 models use internal thinking for complex reasoning:

```typescript
const { text, reasoning } = await generateText({
  model: google('gemini-2.5-flash'),
  prompt: 'What is the sum of the first 10 prime numbers?',
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingBudget: 8192, // Max thinking tokens
        includeThoughts: true, // Get thought summaries
      },
    },
  },
});

console.log(text); // Final answer
console.log(reasoning); // Reasoning summary
```

### File Inputs

Support for PDFs and other file types:

```typescript
import fs from 'fs';

const result = await generateText({
  model: google('gemini-2.5-flash'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this document' },
        {
          type: 'file',
          data: fs.readFileSync('./data/ai.pdf'),
          mediaType: 'application/pdf',
        },
      ],
    },
  ],
});
```

YouTube videos:

```typescript
const result = await generateText({
  model: google('gemini-2.5-flash'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this video' },
        {
          type: 'file',
          data: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          mediaType: 'video/mp4',
        },
      ],
    },
  ],
});
```

### Prompt Caching

#### Implicit Caching (Automatic)

Gemini 2.5 models automatically cache common prefixes:

```typescript
const baseContext = 'You are a cooking assistant... [1000 recipes]';

// First request - no cache
const { text: veggieLasagna } = await generateText({
  model: google('gemini-2.5-pro'),
  prompt: `${baseContext}\n\nWrite a vegetarian lasagna recipe.`,
});

// Second request - cache hit (75% discount on cached tokens)
const { text: meatLasagna, providerMetadata } = await generateText({
  model: google('gemini-2.5-pro'),
  prompt: `${baseContext}\n\nWrite a meat lasagna recipe.`,
});

console.log('Cached tokens:', providerMetadata.google?.usageMetadata);
```

Minimum token requirements for caching:
- Gemini 2.5 Flash: 1024 tokens
- Gemini 2.5 Pro: 2048 tokens

#### Explicit Caching

```typescript
import { GoogleAICacheManager } from '@google/generative-ai/server';

const cacheManager = new GoogleAICacheManager(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY,
);

const { name: cachedContent } = await cacheManager.create({
  model: 'gemini-2.5-pro',
  contents: [
    {
      role: 'user',
      parts: [{ text: '1000 Lasagna Recipes...' }],
    },
  ],
  ttlSeconds: 60 * 5,
});

const result = await generateText({
  model: google('gemini-2.5-pro'),
  prompt: 'Write a vegetarian lasagna recipe.',
  providerOptions: {
    google: { cachedContent },
  },
});
```

### Code Execution

Execute Python code to perform calculations:

```typescript
const { text, toolCalls, toolResults } = await generateText({
  model: google('gemini-2.5-pro'),
  tools: { code_execution: google.tools.codeExecution({}) },
  prompt: 'Use python to calculate the 20th fibonacci number.',
});
```

### Google Search Grounding

Access latest information via Google Search:

```typescript
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';

const { text, sources, providerMetadata } = await generateText({
  model: google('gemini-2.5-flash'),
  tools: {
    google_search: google.tools.googleSearch({}),
  },
  prompt: 'List the top 5 San Francisco news from the past week.',
});

const metadata = providerMetadata?.google as
  | GoogleGenerativeAIProviderMetadata
  | undefined;
const groundingMetadata = metadata?.groundingMetadata;
```

Grounding metadata includes:
- `webSearchQueries`: Search queries used
- `searchEntryPoint`: Main search result content
- `groundingSupports`: How response parts are supported by search

### URL Context

Analyze specific URLs (Gemini 2.0+ models):

```typescript
const { text, providerMetadata } = await generateText({
  model: google('gemini-2.5-flash'),
  prompt: 'Based on https://example.com, answer: ...',
  tools: {
    url_context: google.tools.urlContext({}),
  },
});

const urlContextMetadata = providerMetadata?.google?.urlContextMetadata;
// Up to 20 URLs per request
```

Combine with search:

```typescript
const result = await generateText({
  model: google('gemini-2.5-flash'),
  prompt: 'Based on https://ai-sdk.dev, tell me about AI SDK V5.',
  tools: {
    google_search: google.tools.googleSearch({}),
    url_context: google.tools.urlContext({}),
  },
});
```

### Image Generation

Gemini 2.5 Flash Image Preview generates images:

```typescript
const result = await generateText({
  model: google('gemini-2.5-flash-image-preview'),
  prompt: 'Create a futuristic cityscape at sunset',
});

for (const file of result.files) {
  if (file.mediaType.startsWith('image/')) {
    console.log('Generated image:', file);
  }
}
```

### Safety Settings

```typescript
providerOptions: {
  google: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
}
```

Categories:
- `HARM_CATEGORY_HATE_SPEECH`
- `HARM_CATEGORY_DANGEROUS_CONTENT`
- `HARM_CATEGORY_HARASSMENT`
- `HARM_CATEGORY_SEXUALLY_EXPLICIT`

Thresholds:
- `HARM_BLOCK_THRESHOLD_UNSPECIFIED`
- `BLOCK_LOW_AND_ABOVE`
- `BLOCK_MEDIUM_AND_ABOVE`
- `BLOCK_ONLY_HIGH`
- `BLOCK_NONE`

## Model Capabilities

| Model | Image Input | Object Gen | Tool Usage | Tool Stream | Google Search | URL Context |
|-------|------------|------------|------------|-------------|---------------|-------------|
| `gemini-2.5-pro` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gemini-2.5-flash` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gemini-2.5-flash-lite` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gemini-2.0-flash` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `gemini-1.5-pro` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `gemini-1.5-flash` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

## Embeddings

```typescript
import { embed } from 'ai';

const { embedding } = await embed({
  model: google.textEmbedding('gemini-embedding-001'),
  value: 'sunny day at the beach',
  providerOptions: {
    google: {
      outputDimensionality: 512,
      taskType: 'SEMANTIC_SIMILARITY',
    },
  },
});
```

Task types:
- `SEMANTIC_SIMILARITY`
- `CLASSIFICATION`
- `CLUSTERING`
- `RETRIEVAL_DOCUMENT`
- `RETRIEVAL_QUERY`
- `QUESTION_ANSWERING`
- `FACT_VERIFICATION`
- `CODE_RETRIEVAL_QUERY`

### Embedding Models

| Model | Default Dimensions | Custom Dimensions |
|-------|-------------------|-------------------|
| `gemini-embedding-001` | 3072 | ✓ |
| `text-embedding-004` | 768 | ✓ |

## Image Generation (Imagen)

```typescript
import { experimental_generateImage as generateImage } from 'ai';

const { image } = await generateImage({
  model: google.image('imagen-3.0-generate-002'),
  prompt: 'A futuristic cityscape at sunset',
  aspectRatio: '16:9',
  providerOptions: {
    google: {
      personGeneration: 'dont_allow', // 'allow_adult' | 'allow_all' | 'dont_allow'
    },
  },
});
```

## Troubleshooting

### Schema Limitations

Google uses OpenAPI 3.0 subset - unions and records not supported:

```typescript
// If you get schema errors, disable structured outputs:
const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  providerOptions: {
    google: {
      structuredOutputs: false,
    },
  },
  schema: z.object({
    contact: z.union([...]), // Now works
  }),
});
```

## Best Practices

1. **Caching**: Structure prompts with consistent content at beginning
2. **Thinking**: Enable for complex reasoning and math
3. **Search**: Use for current events and fact-checking
4. **URL Context**: Analyze specific sources (up to 20 URLs)
5. **Safety**: Configure appropriate thresholds for your use case
6. **Files**: Supports PDFs and YouTube videos natively
