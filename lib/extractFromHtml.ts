// HTML content extraction and sanitization

import * as cheerio from 'cheerio';
import type { ExtractedContent, Section, FormInfo, AppFeatures } from './types';

/**
 * Detect form type based on fields and attributes
 */
function detectFormType(fields: string[], action: string): FormInfo['type'] {
  const fieldStr = fields.join(' ').toLowerCase();
  const actionStr = action.toLowerCase();

  if (fieldStr.includes('password') && (fieldStr.includes('email') || fieldStr.includes('username'))) {
    if (fieldStr.includes('confirm') || fieldStr.includes('name') || fields.length > 3) {
      return 'signup';
    }
    return 'login';
  }
  if (fieldStr.includes('search') || actionStr.includes('search')) return 'search';
  if (fieldStr.includes('message') || fieldStr.includes('contact') || actionStr.includes('contact')) return 'contact';
  if (fieldStr.includes('setting') || actionStr.includes('setting')) return 'settings';
  if (fields.length > 4) return 'crud';
  return 'other';
}

/**
 * Detect app type based on patterns found
 */
function detectAppType(
  $: cheerio.CheerioAPI,
  patterns: string[],
  features: Partial<AppFeatures>
): AppFeatures['appType'] {
  const bodyText = $('body').text().toLowerCase();
  const hasProductListing = $('[class*="product"], [class*="item-card"], [class*="shop"]').length > 2;
  const hasCart = $('[class*="cart"], [class*="checkout"]').length > 0;

  if (hasProductListing && hasCart) return 'ecommerce';
  if (features.hasDashboard || features.hasDataTables || features.hasCharts) return 'dashboard';
  if (patterns.includes('Blog/Articles') && $('article').length > 2) return 'blog';
  if ($('[class*="portfolio"], [class*="project"], [class*="work"]').length > 2) return 'portfolio';
  if (features.hasAuth && (patterns.includes('Pricing section') || bodyText.includes('subscription'))) return 'saas';
  if (features.hasAuth || features.hasCRUD || features.hasUserProfile) return 'webapp';
  if (patterns.includes('Hero section') && !features.hasAuth) return 'landing';
  return 'unknown';
}

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
    if (text && headings.length < 30) {
      headings.push(text);
    }
  });

  // Extract navigation
  const navigation: string[] = [];
  $('nav a, header a, [role="navigation"] a').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && navigation.length < 20) {
      navigation.push(text);
    }
  });

  // Extract internal links (for route detection)
  const internalLinks: string[] = [];
  $('a[href^="/"], a[href^="./"], a[href^="#"]').each((_, elem) => {
    const href = $(elem).attr('href') ?? '';
    if (href && !internalLinks.includes(href) && internalLinks.length < 30) {
      internalLinks.push(href);
    }
  });

  // Detect sections and patterns
  const sections: Section[] = [];
  const detectedPatterns: string[] = [];
  const dataPatterns: string[] = [];

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
  if ($('[class*="faq"], [class*="question"], [class*="accordion"]').length > 2) {
    detectedPatterns.push('FAQ section');
    sections.push({
      type: 'faq',
      content: $('[class*="faq"], [class*="accordion"]').first().text().trim().substring(0, 300)
    });
  }

  // Blog detection
  if ($('[class*="blog"], article, [class*="post"]').length > 2) {
    detectedPatterns.push('Blog/Articles');
    sections.push({
      type: 'blog',
      content: $('article').first().text().trim().substring(0, 300)
    });
  }

  // Dashboard detection
  if ($('[class*="dashboard"], [class*="analytics"], [class*="stats"]').length > 0) {
    detectedPatterns.push('Dashboard');
    sections.push({
      type: 'dashboard',
      content: $('[class*="dashboard"]').first().text().trim().substring(0, 300)
    });
  }

  // Settings/Profile detection
  if ($('[class*="settings"], [class*="profile"], [class*="account"]').length > 0) {
    detectedPatterns.push('Settings/Profile');
    sections.push({
      type: 'settings',
      content: $('[class*="settings"], [class*="profile"]').first().text().trim().substring(0, 300)
    });
  }

  // Sidebar detection
  if ($('[class*="sidebar"], aside, [role="complementary"]').length > 0) {
    detectedPatterns.push('Sidebar navigation');
  }

  // Modal detection
  if ($('[class*="modal"], [role="dialog"], [class*="popup"]').length > 0) {
    detectedPatterns.push('Modal dialogs');
  }

  // Extract buttons/CTAs
  const buttons: string[] = [];
  $('button, a.button, a.btn, [role="button"], input[type="submit"], [class*="btn"]').each((_, elem) => {
    const text = $(elem).text().trim() || ($(elem).attr('value') ?? '') || '';
    if (text && buttons.length < 15 && text.length < 50) {
      buttons.push(text);
    }
  });

  // Extract form info with type detection
  const forms: FormInfo[] = [];
  $('form').each((_, elem) => {
    const action = $(elem).attr('action') ?? 'unknown';
    const fields: string[] = [];
    $(elem).find('input, textarea, select').each((_, field) => {
      const type = ($(field).attr('type') ?? '') || String($(field).prop('tagName')).toLowerCase();
      const name = ($(field).attr('name') ?? '') || ($(field).attr('placeholder') ?? '') || type;
      if (name && type !== 'hidden') {
        fields.push(name);
      }
    });
    if (fields.length > 0 && forms.length < 5) {
      forms.push({
        action,
        fields,
        type: detectFormType(fields, action)
      });
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

  // Detect app features
  const appFeatures: AppFeatures = {
    hasAuth: forms.some(f => f.type === 'login' || f.type === 'signup') ||
             $('[class*="login"], [class*="signin"], [class*="signup"], [class*="auth"]').length > 0 ||
             buttons.some(b => /log\s*in|sign\s*in|sign\s*up|register/i.test(b)),

    hasDashboard: $('[class*="dashboard"], [class*="admin"], [class*="panel"]').length > 0 ||
                  headings.some(h => /dashboard|analytics|overview/i.test(h)),

    hasUserProfile: $('[class*="profile"], [class*="avatar"], [class*="user-menu"]').length > 0 ||
                    internalLinks.some(l => /profile|account|user/i.test(l)),

    hasSettings: $('[class*="settings"], [class*="preferences"], [class*="config"]').length > 0 ||
                 internalLinks.some(l => /settings|preferences/i.test(l)),

    hasSearch: forms.some(f => f.type === 'search') ||
               $('[class*="search"], [type="search"], [role="search"]').length > 0,

    hasCRUD: buttons.some(b => /create|add|new|edit|update|delete|remove|save/i.test(b)) ||
             $('[class*="crud"], [class*="actions"]').length > 0,

    hasDataTables: $('table, [class*="table"], [class*="grid"], [role="grid"]').length > 0 ||
                   $('[class*="data-table"], [class*="datatable"]').length > 0,

    hasCharts: $('[class*="chart"], [class*="graph"], canvas, svg[class*="chart"]').length > 0,

    hasNotifications: $('[class*="notification"], [class*="alert"], [class*="toast"], [class*="badge"]').length > 0,

    hasFileUpload: $('input[type="file"], [class*="upload"], [class*="dropzone"]').length > 0,

    hasRealtime: $('[class*="live"], [class*="realtime"], [class*="streaming"]').length > 0 ||
                 $('[class*="chat"], [class*="message"]').length > 0,

    hasPagination: $('[class*="pagination"], [class*="pager"], [aria-label*="pagination"]').length > 0 ||
                   buttons.some(b => /next|prev|page/i.test(b)),

    hasFiltering: $('[class*="filter"], [class*="facet"]').length > 0 ||
                  $('select, [class*="dropdown"]').length > 2,

    hasSorting: $('[class*="sort"], [aria-sort]').length > 0 ||
                buttons.some(b => /sort/i.test(b)),

    appType: 'unknown' // Will be set below
  };

  // Detect data patterns
  if (appFeatures.hasDataTables) dataPatterns.push('Data tables/lists');
  if (appFeatures.hasCharts) dataPatterns.push('Charts/Visualizations');
  if (appFeatures.hasPagination) dataPatterns.push('Paginated data');
  if (appFeatures.hasFiltering) dataPatterns.push('Filterable data');
  if (appFeatures.hasSorting) dataPatterns.push('Sortable data');
  if (appFeatures.hasCRUD) dataPatterns.push('CRUD operations');
  if (appFeatures.hasFileUpload) dataPatterns.push('File uploads');
  if (appFeatures.hasRealtime) dataPatterns.push('Real-time updates');

  // Determine app type
  appFeatures.appType = detectAppType($, detectedPatterns, appFeatures);

  return {
    title,
    description,
    headings,
    navigation,
    sections,
    buttons,
    forms,
    footer,
    detectedPatterns,
    appFeatures,
    internalLinks,
    dataPatterns
  };
}
