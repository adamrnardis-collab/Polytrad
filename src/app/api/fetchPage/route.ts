// API Route: /api/fetchPage
// Securely fetch and extract content from URLs

import { NextRequest, NextResponse } from 'next/server';
import { validateURL, validateRedirectURL, getSafeHeaders, SSRFError } from '@/lib/ssrfProtection';
import { checkRateLimit } from '@/lib/rateLimiter';
import { extractContent, extractFromText, sanitizeHTML } from '@/lib/contentExtractor';
import type { FetchPageRequest, ExtractedContent } from '@/lib/types';

const MAX_FETCH_SIZE = parseInt(process.env.MAX_FETCH_SIZE || '2097152', 10); // 2MB default
const FETCH_TIMEOUT = 15000; // 15 seconds

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = checkRateLimit(request.headers);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${rateLimit.resetTime} seconds.`,
          resetTime: rateLimit.resetTime,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          },
        }
      );
    }

    // Parse request body
    let body: FetchPageRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { mode, input } = body;

    // Validate input
    if (!mode || !input) {
      return NextResponse.json(
        { error: 'Missing required fields: mode and input' },
        { status: 400 }
      );
    }

    if (typeof input !== 'string' || input.length === 0) {
      return NextResponse.json(
        { error: 'Input must be a non-empty string' },
        { status: 400 }
      );
    }

    // Check input size
    if (input.length > MAX_FETCH_SIZE) {
      return NextResponse.json(
        { error: `Input too large. Maximum size: ${MAX_FETCH_SIZE} bytes` },
        { status: 413 }
      );
    }

    let content: ExtractedContent;

    // Handle different input modes
    switch (mode) {
      case 'url':
        content = await fetchAndExtractURL(input);
        break;

      case 'html':
        content = extractFromHTML(input);
        break;

      case 'text':
        content = extractFromText(input);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid mode. Must be: url, html, or text' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      {
        success: true,
        content,
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        },
      }
    );
  } catch (error) {
    console.error('fetchPage error:', error);

    if (error instanceof SSRFError) {
      return NextResponse.json(
        { error: 'Security error', message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Processing failed', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Fetch URL and extract content with security checks
 */
async function fetchAndExtractURL(urlString: string): Promise<ExtractedContent> {
  // Validate URL (SSRF protection)
  const validatedURL = validateURL(urlString);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    // Fetch with safe headers
    const response = await fetch(validatedURL.toString(), {
      method: 'GET',
      headers: getSafeHeaders(),
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Validate redirect URL if redirected
    if (response.url !== validatedURL.toString()) {
      validateRedirectURL(response.url, urlString);
    }

    // Check response status
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error('URL must return HTML or text content');
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FETCH_SIZE) {
      throw new Error(`Content too large. Maximum size: ${MAX_FETCH_SIZE} bytes`);
    }

    // Read response with size limit
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to read response body');
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_FETCH_SIZE) {
        reader.cancel();
        throw new Error(`Content exceeded maximum size: ${MAX_FETCH_SIZE} bytes`);
      }

      chunks.push(value);
    }

    // Combine chunks and decode
    const allChunks = new Uint8Array(totalSize);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    const html = new TextDecoder('utf-8').decode(allChunks);

    // Sanitize and extract
    const sanitized = sanitizeHTML(html);
    return extractContent(sanitized);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }

    throw error;
  }
}

/**
 * Extract content from raw HTML
 */
function extractFromHTML(html: string): ExtractedContent {
  const sanitized = sanitizeHTML(html);
  return extractContent(sanitized);
}
