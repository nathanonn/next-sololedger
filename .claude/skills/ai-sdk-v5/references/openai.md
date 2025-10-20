# OpenAI Provider Reference

## Installation

```bash
npm install @ai-sdk/openai
```

## Setup

```typescript
import { openai } from '@ai-sdk/openai';

// Default instance
const model = openai('gpt-5');

// Custom instance
import { createOpenAI } from '@ai-sdk/openai';
const customOpenAI = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
  organization: 'org-id',
  project: 'project-id',
});
```

## Language Models

### Responses API (Default since AI SDK 5)

```typescript
const model = openai('gpt-5'); // Uses responses API
// or explicitly:
const model = openai.responses('gpt-5');
```

### Provider Options

```typescript
import { generateText } from 'ai';
import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-5'),
  providerOptions: {
    openai: {
      parallelToolCalls: false,
      store: false,
      user: 'user_123',
      reasoningEffort: 'high', // 'minimal' | 'low' | 'medium' | 'high'
      reasoningSummary: 'auto', // 'auto' | 'detailed'
      strictJsonSchema: true,
      serviceTier: 'flex', // 'auto' | 'flex' | 'priority' | 'default'
      textVerbosity: 'medium', // 'low' | 'medium' | 'high'
      include: ['file_search_call.results'],
      promptCacheKey: 'cache-key',
      safetyIdentifier: 'user-id',
    } satisfies OpenAIResponsesProviderOptions,
  },
});
```

Key options:
- **parallelToolCalls**: Enable/disable parallel tool execution (default: true)
- **reasoningEffort**: Control reasoning for o-series models
- **reasoningSummary**: Get reasoning process details
- **serviceTier**: Use 'flex' for 50% cost reduction with higher latency
- **textVerbosity**: Control response length
- **strictJsonSchema**: Enforce strict JSON schema validation

### Provider Metadata

```typescript
const { providerMetadata } = await generateText({
  model: openai.responses('gpt-5'),
});

const openaiMetadata = providerMetadata?.openai;
// Access: responseId, system_fingerprint, etc.
```

## Model Capabilities

### Popular Models

| Model | Image Input | Object Generation | Tool Usage | Tool Streaming |
|-------|------------|-------------------|------------|----------------|
| `gpt-5` | ✓ | ✓ | ✓ | ✓ |
| `gpt-5-mini` | ✓ | ✓ | ✓ | ✓ |
| `gpt-5-nano` | ✓ | ✗ | ✓ | ✓ |
| `o3` | ✓ | ✓ | ✓ | ✓ |
| `o4-mini` | ✓ | ✓ | ✓ | ✓ |
| `gpt-4.1` | ✓ | ✓ | ✓ | ✓ |
| `gpt-4.1-mini` | ✓ | ✗ | ✓ | ✓ |
| `gpt-4.1-nano` | ✓ | ✗ | ✓ | ✓ |
| `gpt-4o` | ✓ | ✗ | ✓ | ✓ |
| `gpt-4o-mini` | ✓ | ✗ | ✓ | ✓ |

## Embeddings

```typescript
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

const { embedding } = await embed({
  model: openai.textEmbedding('text-embedding-3-large'),
  value: 'sunny day at the beach',
  providerOptions: {
    openai: {
      dimensions: 512,
      user: 'test-user',
    },
  },
});
```

### Embedding Models

| Model | Default Dimensions | Custom Dimensions |
|-------|-------------------|-------------------|
| `text-embedding-3-large` | 3072 | ✓ |
| `text-embedding-3-small` | 1536 | ✓ |
| `text-embedding-ada-002` | 1536 | ✗ |

## Image Generation

```typescript
import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: openai.image('dall-e-3'),
  prompt: 'A salamander at sunrise',
  size: '1024x1024',
  providerOptions: {
    openai: { quality: 'high' },
  },
});
```

### Image Models

| Model | Sizes |
|-------|-------|
| `gpt-image-1-mini` | 1024x1024, 1536x1024, 1024x1536 |
| `gpt-image-1` | 1024x1024, 1536x1024, 1024x1536 |
| `dall-e-3` | 1024x1024, 1792x1024, 1024x1792 |
| `dall-e-2` | 256x256, 512x512, 1024x1024 |

## Audio

### Transcription

```typescript
import { experimental_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await transcribe({
  model: openai.transcription('whisper-1'),
  audio: audioData,
  providerOptions: {
    openai: {
      language: 'en',
      timestampGranularities: ['segment'],
      prompt: 'Optional context',
      temperature: 0,
    },
  },
});
```

### Speech Synthesis

```typescript
import { experimental_generateSpeech as generateSpeech } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateSpeech({
  model: openai.speech('tts-1'),
  text: 'Hello, world!',
  providerOptions: {
    openai: {
      instructions: 'Speak slowly',
      response_format: 'mp3',
      speed: 1.0,
    },
  },
});
```

## Best Practices

1. **Cost Optimization**: Use `serviceTier: 'flex'` for non-urgent requests (50% cheaper)
2. **Reasoning Models**: Set appropriate `reasoningEffort` for o-series models
3. **Caching**: Use `promptCacheKey` for repeated similar requests
4. **Streaming**: Prefer `streamText` for better UX in chat applications
5. **Error Handling**: Always wrap API calls in try-catch blocks
