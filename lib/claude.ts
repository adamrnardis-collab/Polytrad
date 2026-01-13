// Anthropic Claude API client (SERVER-SIDE ONLY)

import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedContent, BuildIntent } from './types';

// Ensure this only runs on server
if (typeof window !== 'undefined') {
  throw new Error('Claude client must only be used server-side. API key would be exposed!');
}

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('ANTHROPIC_API_KEY not found in environment variables');
}

const anthropic = new Anthropic({
  apiKey: apiKey || 'placeholder',
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 4096;

/**
 * Generate a vibe-coding prompt from extracted content
 */
export async function generateVibePrompt(
  content: ExtractedContent,
  intent: BuildIntent
): Promise<{ prompt: string; assumptions: string }> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your environment variables.');
  }

  const intentDescriptions = {
    clone: 'Create a faithful recreation of the structure and functionality',
    modernize: 'Modernize the design while preserving core structure',
    saas: 'Transform into a modern SaaS landing page'
  };

  const systemPrompt = `You are an expert at analyzing websites and creating detailed implementation prompts for AI coding assistants like Cursor, v0, Lovable, and Replit.

Your task: Generate ONE comprehensive, copy-ready "vibe-coding prompt" that will help an AI assistant recreate the website's structure and functionality.

CRITICAL LEGAL/ETHICAL REQUIREMENTS:
- Do NOT copy proprietary text, images, or branding verbatim
- Instruct to recreate STRUCTURE and FUNCTIONALITY with ORIGINAL content
- Emphasize creating a DISTINCT visual identity
- This is for inspiration and development, not exact duplication
- Users must have rights to any copied content

The prompt must be:
- Structured and clear
- Immediately usable
- Practical, no fluff
- Focused on implementation

Include these sections:
1. Goal/Objective
2. Tech Stack (Next.js App Router, Tailwind, shadcn/ui optional)
3. Page Structure (sections in order)
4. Component Breakdown (Header, Hero, Features, etc.)
5. Content Strategy (rewrite original tone, use placeholders)
6. Styling Direction (typography, spacing, colors - approximate)
7. Responsive Rules (mobile/tablet/desktop)
8. Image/Icon Handling (placeholders, suggested sources)
9. Accessibility Checklist
10. Implementation Steps
11. "Keep it simple, don't overengineer"
12. Legal reminder`;

  const userPrompt = `Analyze this website and create a vibe-coding prompt:

**Intent:** ${intentDescriptions[intent]}

**Extracted Content:**
- Title: ${content.title}
- Description: ${content.description}
- Headings: ${content.headings.slice(0, 10).join(', ')}
- Navigation: ${content.navigation.join(', ')}
- Detected Patterns: ${content.detectedPatterns.join(', ')}
- CTAs: ${content.buttons.slice(0, 5).join(', ')}
- Forms: ${content.forms.length} form(s) detected
- Footer Links: ${content.footer.slice(0, 10).join(', ')}

**Sections:**
${content.sections.map(s => `- ${s.type}: ${s.content.substring(0, 200)}`).join('\n')}

Create the vibe-coding prompt now. Be specific and actionable.`;

  try {
    console.log('Calling Claude API with model:', MODEL);
    console.log('API key configured:', !!apiKey);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('\n');

    // Extract assumptions (look for a dedicated section)
    const assumptionsMatch = textContent.match(/## Assumptions.*?\n([\s\S]*?)(?=\n##|$)/i);
    const assumptions = assumptionsMatch
      ? assumptionsMatch[1].trim()
      : 'Standard modern web app assumptions applied.';

    return {
      prompt: textContent,
      assumptions
    };
  } catch (error) {
    console.error('Claude API Error Details:', error);

    if (error instanceof Anthropic.APIError) {
      console.error('API Error Status:', error.status);
      console.error('API Error Type:', error.type);
      console.error('API Error Message:', error.message);

      // Return detailed error
      throw new Error(`Claude API error (${error.status}): ${error.message}`);
    }
    throw error;
  }
}
