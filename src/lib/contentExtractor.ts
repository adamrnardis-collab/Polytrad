// Content Extractor - Extract clean content from HTML

import * as cheerio from 'cheerio';
import type { ExtractedContent } from './types';

const MAX_CONTENT_LENGTH = 50000; // Maximum characters to extract
const MAX_ITEMS_PER_CATEGORY = 100; // Max items for arrays

/**
 * Extract structured content from HTML
 * @param html - Raw HTML string
 * @returns {ExtractedContent} Structured content object
 */
export function extractContent(html: string): ExtractedContent {
  const $ = cheerio.load(html);

  // Remove script, style, iframe, and other dangerous elements
  $('script, style, iframe, noscript, svg, object, embed').remove();

  // Remove comments
  $('*').contents().each(function() {
    if (this.type === 'comment') {
      $(this).remove();
    }
  });

  // Extract title
  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

  // Extract headings
  const headings: Array<{ level: number; text: string }> = [];
  $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && headings.length < MAX_ITEMS_PER_CATEGORY) {
      const level = parseInt(elem.tagName.substring(1));
      headings.push({ level, text });
    }
  });

  // Extract paragraphs
  const paragraphs: string[] = [];
  $('p').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 20 && paragraphs.length < MAX_ITEMS_PER_CATEGORY) {
      paragraphs.push(truncateText(text, 500));
    }
  });

  // Extract navigation items
  const navigation: string[] = [];
  $('nav a, header a, [role="navigation"] a').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && navigation.length < MAX_ITEMS_PER_CATEGORY) {
      navigation.push(text);
    }
  });

  // Extract links
  const links: Array<{ text: string; href: string }> = [];
  $('a[href]').each((_, elem) => {
    const text = $(elem).text().trim();
    const href = $(elem).attr('href') || '';
    if (text && href && links.length < MAX_ITEMS_PER_CATEGORY) {
      links.push({ text, href: truncateText(href, 200) });
    }
  });

  // Extract CTA buttons
  const ctaButtons: string[] = [];
  $('button, a.btn, a.button, [role="button"], input[type="submit"]').each((_, elem) => {
    const text = $(elem).text().trim() || $(elem).attr('value') || '';
    if (text && ctaButtons.length < MAX_ITEMS_PER_CATEGORY) {
      ctaButtons.push(text);
    }
  });

  // Extract metadata
  const description = $('meta[name="description"]').attr('content') ||
                     $('meta[property="og:description"]').attr('content') || '';
  const keywords = $('meta[name="keywords"]').attr('content') || '';

  // Analyze structure
  const structure = {
    hasHeader: $('header').length > 0 || $('[role="banner"]').length > 0,
    hasFooter: $('footer').length > 0 || $('[role="contentinfo"]').length > 0,
    hasNav: $('nav').length > 0 || $('[role="navigation"]').length > 0,
    hasSidebar: $('aside').length > 0 || $('.sidebar').length > 0 || $('[role="complementary"]').length > 0,
  };

  const extracted: ExtractedContent = {
    title: truncateText(title, 200),
    headings,
    paragraphs,
    navigation,
    links,
    ctaButtons,
    metadata: {
      description: truncateText(description, 500),
      keywords: truncateText(keywords, 200),
    },
    structure,
  };

  // Ensure total content doesn't exceed maximum
  return trimToMaxLength(extracted, MAX_CONTENT_LENGTH);
}

/**
 * Extract content from plain text (when user pastes text directly)
 */
export function extractFromText(text: string): ExtractedContent {
  const lines = text.split('\n').filter(line => line.trim());

  const paragraphs = lines
    .filter(line => line.length > 20)
    .slice(0, MAX_ITEMS_PER_CATEGORY)
    .map(line => truncateText(line.trim(), 500));

  // Try to identify title (first line if it's short and capitalized)
  const firstLine = lines[0] || 'Untitled';
  const title = firstLine.length < 100 ? firstLine : 'User Provided Text';

  return {
    title: truncateText(title, 200),
    headings: [],
    paragraphs,
    navigation: [],
    links: [],
    ctaButtons: [],
    metadata: {},
    structure: {
      hasHeader: false,
      hasFooter: false,
      hasNav: false,
      hasSidebar: false,
    },
  };
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Trim extracted content to ensure it doesn't exceed max length
 */
function trimToMaxLength(content: ExtractedContent, maxLength: number): ExtractedContent {
  const estimatedLength = JSON.stringify(content).length;

  if (estimatedLength <= maxLength) {
    return content;
  }

  // Progressively reduce content
  const trimmed = { ...content };

  // First, reduce paragraphs
  if (trimmed.paragraphs.length > 20) {
    trimmed.paragraphs = trimmed.paragraphs.slice(0, 20);
  }

  // Then links
  if (trimmed.links.length > 30) {
    trimmed.links = trimmed.links.slice(0, 30);
  }

  // Then headings
  if (trimmed.headings.length > 30) {
    trimmed.headings = trimmed.headings.slice(0, 30);
  }

  return trimmed;
}

/**
 * Sanitize HTML input to remove dangerous content
 */
export function sanitizeHTML(html: string): string {
  const $ = cheerio.load(html);

  // Remove all script tags and event handlers
  $('script, style, iframe, object, embed').remove();

  // Remove all event handler attributes
  $('*').each((_, elem) => {
    const attributes = elem.attribs;
    for (const attr in attributes) {
      if (attr.startsWith('on')) {
        $(elem).removeAttr(attr);
      }
    }
  });

  return $.html();
}
