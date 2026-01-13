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
    console.error('Error type:', error instanceof Error ? 'Error' : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));

    // Return the actual error message for debugging
    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Generation Failed',
          message: error.message,
          details: 'Check Netlify function logs for more details'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Unexpected error occurred',
        message: String(error)
      },
      { status: 500 }
    );
  }
}
