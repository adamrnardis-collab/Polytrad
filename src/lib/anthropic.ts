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
 * Helper for JSON responses (attempts to parse with multiple strategies)
 */
export async function callClaudeJSON<T>(options: ClaudeCallOptions): Promise<T> {
  const response = await callClaude(options);

  // Log for debugging (truncated)
  console.log('Claude response (first 200 chars):', response.substring(0, 200));

  // Strategy 1: Try to extract JSON from markdown code blocks
  const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as T;
    } catch (error) {
      console.log('Strategy 1 (markdown block) failed, trying next...');
    }
  }

  // Strategy 2: Try to find JSON object by looking for { ... }
  const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      return JSON.parse(jsonObjectMatch[0].trim()) as T;
    } catch (error) {
      console.log('Strategy 2 (regex extraction) failed, trying next...');
    }
  }

  // Strategy 3: Try the raw response
  try {
    return JSON.parse(response.trim()) as T;
  } catch (error) {
    console.log('Strategy 3 (raw parse) failed, trying next...');
  }

  // Strategy 4: Remove common prefixes and try again
  const cleanedResponse = response
    .replace(/^Here's the JSON.*?:\s*/i, '')
    .replace(/^Here is the.*?:\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleanedResponse) as T;
  } catch (parseError) {
    // All strategies failed
    console.error('All parsing strategies failed. Full response:', response);
    throw new Error(
      `Claude did not return valid JSON after multiple parsing attempts. ` +
      `Response started with: "${response.substring(0, 100)}..."`
    );
  }
}

/**
 * Generate website DNA using Claude
 */
export async function generateWebsiteDNAWithClaude(prompt: string): Promise<any> {
  return callClaudeJSON({
    system: 'You MUST respond ONLY with raw JSON. No markdown formatting, no code blocks, no explanations. Just the JSON object starting with { and ending with }. Do not wrap it in ```json or any other formatting.',
    messages: [{ role: 'user', content: `${prompt}\n\nCRITICAL: Your entire response must be ONLY the JSON object. First character: { Last character: }` }],
    maxTokens: 2000,
    temperature: 0.3,
  });
}

/**
 * Generate rebuild spec using Claude
 */
export async function generateRebuildSpecWithClaude(prompt: string): Promise<any> {
  return callClaudeJSON({
    system: 'You MUST respond ONLY with raw JSON. No markdown formatting, no code blocks, no explanations. Just the JSON object starting with { and ending with }. Do not wrap it in ```json or any other formatting.',
    messages: [{ role: 'user', content: `${prompt}\n\nCRITICAL: Your entire response must be ONLY the JSON object. First character: { Last character: }` }],
    maxTokens: 3000,
    temperature: 0.3,
  });
}

/**
 * Generate critique using Claude
 */
export async function generateCritiqueWithClaude(prompt: string): Promise<any> {
  return callClaudeJSON({
    system: 'You MUST respond ONLY with raw JSON. No markdown formatting, no code blocks, no explanations. Just the JSON object starting with { and ending with }. Do not wrap it in ```json or any other formatting.',
    messages: [{ role: 'user', content: `${prompt}\n\nCRITICAL: Your entire response must be ONLY the JSON object. First character: { Last character: }` }],
    maxTokens: 1500,
    temperature: 0.3,
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
