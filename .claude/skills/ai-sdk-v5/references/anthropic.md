# Anthropic Provider Reference

## Installation

```bash
npm install @ai-sdk/anthropic
```

## Setup

```typescript
import { anthropic } from '@ai-sdk/anthropic';

// Default instance
const model = anthropic('claude-sonnet-4-20250514');

// Custom instance
import { createAnthropic } from '@ai-sdk/anthropic';
const customAnthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});
```

## Language Models

### Basic Usage

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Provider Options

```typescript
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  providerOptions: {
    anthropic: {
      disableParallelToolUse: false,
      sendReasoning: true,
      thinking: {
        type: 'enabled',
        budgetTokens: 12000,
      },
      cacheControl: { type: 'ephemeral' },
    } satisfies AnthropicProviderOptions,
  },
});
```

## Advanced Features

### Reasoning (Extended Thinking)

Enable reasoning for opus-4, sonnet-4, and claude-3-7-sonnet models:

```typescript
const { text, reasoning, reasoningDetails } = await generateText({
  model: anthropic('claude-opus-4-20250514'),
  prompt: 'How many people will live in the world in 2040?',
  providerOptions: {
    anthropic: {
      thinking: {
        type: 'enabled',
        budgetTokens: 12000, // Max thinking tokens
      },
    },
  },
});

console.log(reasoning); // Reasoning text
console.log(reasoningDetails); // Includes redacted reasoning
```

### Structured Output Streaming

Enable fine-grained streaming for tool inputs and structured outputs:

```typescript
import { streamObject } from 'ai';
import { z } from 'zod';

const result = streamObject({
  model: anthropic('claude-sonnet-4-20250514'),
  schema: z.object({
    characters: z.array(
      z.object({
        name: z.string(),
        class: z.string(),
        description: z.string(),
      }),
    ),
  }),
  prompt: 'Generate 3 RPG characters.',
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },
});

for await (const partialObject of result.partialObjectStream) {
  console.log(partialObject);
}
```

### Prompt Caching

Cache frequently reused context to reduce costs:

```typescript
const errorMessage = '... long error message ...';

const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'You are a JavaScript expert.' },
        {
          type: 'text',
          text: `Error message: ${errorMessage}`,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        { type: 'text', text: 'Explain the error.' },
      ],
    },
  ],
});

console.log(result.providerMetadata?.anthropic);
// { cacheCreationInputTokens: 2118 }
```

Cache on system messages:

```typescript
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20240620'),
  messages: [
    {
      role: 'system',
      content: 'Cached system message part',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
    {
      role: 'system',
      content: 'Uncached system message part',
    },
    // ... user messages
  ],
});
```

### Web Search

Built-in web search tool:

```typescript
const webSearchTool = anthropic.tools.webSearch_20250825();

const result = await generateText({
  model: anthropic('claude-opus-4-20250514'),
  prompt: 'What are the latest developments in AI?',
  tools: {
    web_search: webSearchTool,
  },
});
```

### Code Execution

Python code execution in sandboxed environment:

```typescript
const codeExecutionTool = anthropic.tools.codeExecution_20250825();

const result = await generateText({
  model: anthropic('claude-opus-4-20250514'),
  prompt: 'Calculate mean and std dev of [1,2,3,4,5,6,7,8,9,10]',
  tools: {
    code_execution: codeExecutionTool,
  },
});
```

### Agent Skills

Enable document processing and data analysis:

```typescript
const result = await generateText({
  model: anthropic('claude-sonnet-4-5'),
  tools: {
    code_execution: anthropic.tools.codeExecution_20250825(),
  },
  prompt: 'Create a presentation about renewable energy with 5 slides',
  providerOptions: {
    anthropic: {
      container: {
        skills: [
          {
            type: 'anthropic',
            skillId: 'pptx', // or 'docx', 'pdf', 'xlsx'
            version: 'latest',
          },
        ],
      },
    },
  },
});
```

Custom skills:

```typescript
providerOptions: {
  anthropic: {
    container: {
      skills: [
        {
          type: 'custom',
          skillId: 'my-custom-skill-id',
          version: '1.0',
        },
      ],
    },
  },
}
```

### PDF Support

```typescript
// URL-based PDF
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this document' },
        {
          type: 'file',
          data: new URL('https://example.com/doc.pdf'),
          mimeType: 'application/pdf',
        },
      ],
    },
  ],
});

// Base64-encoded PDF
import fs from 'fs';

const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this document' },
        {
          type: 'file',
          data: fs.readFileSync('./doc.pdf'),
          mediaType: 'application/pdf',
        },
      ],
    },
  ],
});
```

## Model Capabilities

| Model | Image Input | Object Generation | Tool Usage | Computer Use | Web Search |
|-------|------------|-------------------|------------|--------------|------------|
| `claude-haiku-4-5` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `claude-sonnet-4-5` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `claude-opus-4-1` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `claude-opus-4-0` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `claude-sonnet-4-0` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `claude-3-7-sonnet-latest` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `claude-3-5-haiku-latest` | ✓ | ✓ | ✓ | ✓ | ✓ |

## Best Practices

1. **Reasoning**: Use `thinking` for complex analytical tasks
2. **Caching**: Cache large context blocks to reduce costs (75% off cached tokens)
3. **Streaming**: Enable fine-grained streaming for better UX
4. **Skills**: Use built-in skills for document processing
5. **Web Search**: Enable for current events and fact-checking
6. **Code Execution**: Use for mathematical and data analysis tasks
