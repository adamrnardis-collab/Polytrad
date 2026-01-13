// API Route: /api/fetchPage
// Securely fetch and extract content from URLs

import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/validateUrl';
import { extractFromHtml } from '@/lib/extractFromHtml';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const TIMEOUT = 15000; // 15 seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL (SSRF protection)
    let validatedUrl;
    try {
      validatedUrl = validateUrl(url);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Invalid URL',
          message: error instanceof Error ? error.message : 'URL validation failed'
        },
        { status: 400 }
      );
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    let response;
    try {
      response = await fetch(validatedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PromptMirror/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      return NextResponse.json(
        {
          error: 'Fetch failed',
          message: "Couldn't fetch this page. Please paste the site's HTML instead.",
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'HTTP error',
          message: `Server returned ${response.status}. Please paste the site's HTML instead.`
        },
        { status: response.status }
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return NextResponse.json(
        { error: 'Invalid content type. Expected HTML.' },
        { status: 400 }
      );
    }

    // Read response with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: 'Failed to read response' },
        { status: 500 }
      );
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > MAX_SIZE) {
          reader.cancel();
          return NextResponse.json(
            { error: 'Page too large (max 5MB)' },
            { status: 413 }
          );
        }

        chunks.push(value);
      }
    } catch (readError) {
      return NextResponse.json(
        { error: 'Failed to read page content' },
        { status: 500 }
      );
    }

    // Combine chunks and decode
    const allChunks = new Uint8Array(totalSize);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    const html = new TextDecoder('utf-8').decode(allChunks);

    // Extract content
    const extracted = extractFromHtml(html);

    return NextResponse.json({
      success: true,
      content: extracted
    });

  } catch (error) {
    console.error('fetchPage error:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
