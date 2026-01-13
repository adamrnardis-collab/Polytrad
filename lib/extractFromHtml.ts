// HTML content extraction and sanitization

import * as cheerio from 'cheerio';
import type { ExtractedContent, Section } from './types';

/**
 * Extract structured content from HTML
 */
export function extractFromHtml(html: string): ExtractedContent {
  const $ = cheerio.load(html);

  // Remove dangerous elements
  $('script, style, iframe, object, embed, noscript').remove();

  // Extract title
  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

  // Extract meta description
  const description =
    ($('meta[name="description"]').attr('content') ?? '') ||
    ($('meta[property="og:description"]').attr('content') ?? '') ||
    '';

  // Extract headings (h1-h3 only)
  const headings: string[] = [];
  $('h1, h2, h3').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && headings.length < 20) {
      headings.push(text);
    }
  });

  // Extract navigation
  const navigation: string[] = [];
  $('nav a, header a, [role="navigation"] a').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && navigation.length < 15) {
      navigation.push(text);
    }
  });

  // Detect sections and patterns
  const sections: Section[] = [];
  const detectedPatterns: string[] = [];

  // Hero detection
  const heroSelectors = [
    'section.hero',
    '.hero',
    '[class*="hero"]',
    'header + section',
    'main > section:first-child'
  ];

  for (const selector of heroSelectors) {
    const hero = $(selector).first();
    if (hero.length) {
      sections.push({
        type: 'hero',
        content: hero.text().trim().substring(0, 500)
      });
      detectedPatterns.push('Hero section');
      break;
    }
  }

  // Features detection
  if ($('[class*="feature"], [class*="benefit"]').length >= 3) {
    detectedPatterns.push('Features grid');
    sections.push({
      type: 'features',
      content: $('[class*="feature"], [class*="benefit"]').first().text().trim().substring(0, 300)
    });
  }

  // Testimonials detection
  if ($('[class*="testimonial"], [class*="review"]').length > 0) {
    detectedPatterns.push('Testimonials/Reviews');
    sections.push({
      type: 'testimonials',
      content: $('[class*="testimonial"]').first().text().trim().substring(0, 300)
    });
  }

  // Pricing detection
  if ($('[class*="pricing"], [class*="plan"]').length > 0) {
    detectedPatterns.push('Pricing section');
    sections.push({
      type: 'pricing',
      content: $('[class*="pricing"]').first().text().trim().substring(0, 300)
    });
  }

  // FAQ detection
  if ($('[class*="faq"], [class*="question"]').length > 2) {
    detectedPatterns.push('FAQ section');
  }

  // Blog detection
  if ($('[class*="blog"], [class*="article"], [class*="post"]').length > 2) {
    detectedPatterns.push('Blog/Articles');
  }

  // Extract buttons/CTAs
  const buttons: string[] = [];
  $('button, a.button, a.btn, [role="button"], input[type="submit"]').each((_, elem) => {
    const text = $(elem).text().trim() || ($(elem).attr('value') ?? '') || '';
    if (text && buttons.length < 10) {
      buttons.push(text);
    }
  });

  // Extract form info
  const forms: any[] = [];
  $('form').each((_, elem) => {
    const action = $(elem).attr('action') ?? 'unknown';
    const fields: string[] = [];
    $(elem).find('input, textarea, select').each((_, field) => {
      const type = ($(field).attr('type') ?? '') || String($(field).prop('tagName')).toLowerCase();
      const name = ($(field).attr('name') ?? '') || ($(field).attr('placeholder') ?? '') || type;
      fields.push(name);
    });
    if (fields.length > 0 && forms.length < 3) {
      forms.push({ action, fields });
    }
  });

  // Extract footer content
  const footer: string[] = [];
  $('footer a, [role="contentinfo"] a').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && footer.length < 20) {
      footer.push(text);
    }
  });

  return {
    title,
    description,
    headings,
    navigation,
    sections,
    buttons,
    forms,
    footer,
    detectedPatterns
  };
}
