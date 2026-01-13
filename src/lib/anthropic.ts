// Anthropic Claude API Client (Server-side only)

import Anthropic from '@anthropic-ai/sdk';

// Ensure this only runs on server
if (typeof window !== 'undefined') {
  throw new Error('Anthropic client must only be used server-side');
}

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('ANTHROPIC_API_KEY not found in environment variables');
}

export const anthropic = new Anthropic({
  apiKey: apiKey || 'placeholder',
});

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 60000; // 60 seconds

interface ClaudeCallOptions {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * Call Claude with timeout and error handling
 */
export async function callClaude(options: ClaudeCallOptions): Promise<string> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const {
    system,
    messages,
    maxTokens = MAX_TOKENS,
    temperature = 1.0,
    timeout = TIMEOUT_MS,
  } = options;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    });

    clearTimeout(timeoutId);

    // Extract text content
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    return textContent;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude API request timed out');
    }

    if (error instanceof Anthropic.APIError) {
      throw new Error(`Claude API error: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Helper for JSON responses (attempts to parse)
 */
export async function callClaudeJSON<T>(options: ClaudeCallOptions): Promise<T> {
  const response = await callClaude(options);

  // Log for debugging (truncated)
  console.log('Claude response (first 200 chars):', response.substring(0, 200));

  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonString = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonString.trim()) as T;
  } catch (error) {
    // If parsing fails, try the raw response
    try {
      return JSON.parse(response.trim()) as T;
    } catch (parseError) {
      console.error('Failed to parse Claude JSON response:', {
        responsePreview: response.substring(0, 500),
        error: parseError instanceof Error ? parseError.message : 'Unknown error'
      });
      throw new Error(`Claude returned invalid JSON. Response preview: ${response.substring(0, 200)}...`);
    }
  }
}

/**
 * Generate website DNA using Claude
 */
export async function generateWebsiteDNAWithClaude(prompt: string): Promise<any> {
  return callClaudeJSON({
    system: 'You are a UX/UI expert analyzing websites. You MUST respond with ONLY valid JSON - no explanation, no markdown, no extra text. Start with { and end with }.',
    messages: [{ role: 'user', content: `${prompt}\n\nIMPORTANT: Return ONLY the JSON object, no other text.` }],
    maxTokens: 2000,
    temperature: 0.7,
  });
}

/**
 * Generate rebuild spec using Claude
 */
export async function generateRebuildSpecWithClaude(prompt: string): Promise<any> {
  return callClaudeJSON({
    system: 'You are a senior software architect specializing in Next.js. You MUST respond with ONLY valid JSON - no explanation, no markdown, no extra text. Start with { and end with }.',
    messages: [{ role: 'user', content: `${prompt}\n\nIMPORTANT: Return ONLY the JSON object, no other text.` }],
    maxTokens: 3000,
    temperature: 0.7,
  });
}

/**
 * Generate critique using Claude
 */
export async function generateCritiqueWithClaude(prompt: string): Promise<any> {
  return callClaudeJSON({
    system: 'You are a technical reviewer providing constructive feedback. You MUST respond with ONLY valid JSON - no explanation, no markdown, no extra text. Start with { and end with }.',
    messages: [{ role: 'user', content: `${prompt}\n\nIMPORTANT: Return ONLY the JSON object, no other text.` }],
    maxTokens: 1500,
    temperature: 0.7,
  });
}

/**
 * Refine prompt using Claude
 */
export async function refinePromptWithClaude(prompt: string): Promise<string> {
  return callClaude({
    system: 'You are a technical writing expert specializing in AI prompts. Improve the given prompt for clarity and actionability.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4000,
  });
}
