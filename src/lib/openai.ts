// OpenAI ChatGPT API Client (Server-side only)

import OpenAI from 'openai';

// Ensure this only runs on server
if (typeof window !== 'undefined') {
  throw new Error('OpenAI client must only be used server-side');
}

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('OPENAI_API_KEY not found in environment variables');
}

export const openai = new OpenAI({
  apiKey: apiKey || 'placeholder',
});

// Cost-optimized default: gpt-4o-mini (85% cheaper than gpt-4, minimal quality loss)
// For max quality: gpt-4 (~$0.45/request vs ~$0.03/request for gpt-4o-mini)
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 60000; // 60 seconds

interface GPTCallOptions {
  system?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * Call ChatGPT with timeout and error handling
 */
export async function callGPT(options: GPTCallOptions): Promise<string> {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const {
    system,
    messages: userMessages,
    maxTokens = MAX_TOKENS,
    temperature = 1.0,
    timeout = TIMEOUT_MS,
  } = options;

  // Build messages array
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (system) {
    messages.push({ role: 'system', content: system });
  }

  messages.push(...userMessages.map(msg => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content,
  })));

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    }, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in GPT response');
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out');
    }

    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Helper for JSON responses (attempts to parse)
 */
export async function callGPTJSON<T>(options: GPTCallOptions): Promise<T> {
  const response = await callGPT(options);

  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonString = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonString.trim()) as T;
  } catch (error) {
    // If parsing fails, try the raw response
    try {
      return JSON.parse(response.trim()) as T;
    } catch {
      throw new Error(`Failed to parse GPT response as JSON: ${response.substring(0, 200)}`);
    }
  }
}

/**
 * Generate website DNA using ChatGPT
 */
export async function generateWebsiteDNAWithGPT(prompt: string): Promise<any> {
  return callGPTJSON({
    system: 'You are a UX/UI expert analyzing websites. Always respond with valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2000,
  });
}

/**
 * Generate rebuild spec using ChatGPT
 */
export async function generateRebuildSpecWithGPT(prompt: string): Promise<any> {
  return callGPTJSON({
    system: 'You are a senior software architect specializing in Next.js. Always respond with valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 3000,
  });
}

/**
 * Generate critique using ChatGPT
 */
export async function generateCritiqueWithGPT(prompt: string): Promise<any> {
  return callGPTJSON({
    system: 'You are a technical reviewer providing constructive feedback. Always respond with valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1500,
  });
}

/**
 * Refine prompt using ChatGPT
 */
export async function refinePromptWithGPT(prompt: string): Promise<string> {
  return callGPT({
    system: 'You are a technical writing expert specializing in AI prompts. Improve the given prompt for clarity and actionability.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4000,
  });
}
