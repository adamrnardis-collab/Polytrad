// API Route: /api/generate
// Generate vibe-coding prompt using Claude

import { NextRequest, NextResponse } from 'next/server';
import { generateVibePrompt } from '@/lib/claude';
import type { GenerateRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { content, intent } = body;

    // Validate input
    if (!content || !intent) {
      return NextResponse.json(
        { error: 'Missing required fields: content and intent' },
        { status: 400 }
      );
    }

    if (!['clone', 'modernize', 'saas'].includes(intent)) {
      return NextResponse.json(
        { error: 'Invalid intent. Must be: clone, modernize, or saas' },
        { status: 400 }
      );
    }

    // Generate prompt using Claude
    const { prompt, assumptions } = await generateVibePrompt(content, intent);

    // Create extraction summary
    const extractedSummary = `**Title:** ${content.title}

**Detected Patterns:** ${content.detectedPatterns.join(', ') || 'None'}

**Structure:**
- ${content.headings.length} headings
- ${content.navigation.length} navigation items
- ${content.sections.length} main sections
- ${content.buttons.length} CTAs/buttons
- ${content.forms.length} forms
- ${content.footer.length} footer links`;

    return NextResponse.json({
      success: true,
      prompt,
      assumptions,
      extractedSummary
    });

  } catch (error) {
    console.error('generate error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            error: 'Configuration Error',
            message: 'Claude API key is not configured. Please set ANTHROPIC_API_KEY.'
          },
          { status: 500 }
        );
      }

      if (error.message.includes('Claude API error')) {
        return NextResponse.json(
          {
            error: 'AI Service Error',
            message: 'Claude API request failed. Please try again.'
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Generation Failed',
          message: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Unexpected error occurred' },
      { status: 500 }
    );
  }
}
