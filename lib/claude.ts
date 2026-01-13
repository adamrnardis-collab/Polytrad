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
  timeout: 25000, // 25 second timeout (under Netlify's 26s limit)
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096; // Balanced for good prompts within timeout limits

/**
 * Generate a comprehensive vibe-coding prompt from extracted content
 */
export async function generateVibePrompt(
  content: ExtractedContent,
  intent: BuildIntent
): Promise<{ prompt: string; assumptions: string }> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your environment variables.');
  }

  const intentDescriptions = {
    clone: 'Create a faithful recreation of the full application structure, functionality, and user flows',
    modernize: 'Modernize the design and tech stack while preserving all core functionality and features',
    saas: 'Transform into a production-ready SaaS application with proper architecture'
  };

  // Build app features summary
  const appFeatures = content.appFeatures;
  const featuresList = [
    appFeatures.hasAuth && 'Authentication system',
    appFeatures.hasDashboard && 'Dashboard/Analytics',
    appFeatures.hasUserProfile && 'User profiles',
    appFeatures.hasSettings && 'Settings/Preferences',
    appFeatures.hasSearch && 'Search functionality',
    appFeatures.hasCRUD && 'CRUD operations',
    appFeatures.hasDataTables && 'Data tables/lists',
    appFeatures.hasCharts && 'Charts/Visualizations',
    appFeatures.hasNotifications && 'Notifications',
    appFeatures.hasFileUpload && 'File uploads',
    appFeatures.hasRealtime && 'Real-time features',
    appFeatures.hasPagination && 'Pagination',
    appFeatures.hasFiltering && 'Filtering',
    appFeatures.hasSorting && 'Sorting'
  ].filter(Boolean).join(', ') || 'Basic web app features';

  const systemPrompt = `You are an expert full-stack architect who creates comprehensive implementation blueprints for AI coding assistants (Cursor, v0, Lovable, Bolt, Replit).

Your task: Generate a COMPLETE, PRODUCTION-READY implementation prompt that covers the ENTIRE application - not just a landing page. This prompt should enable an AI assistant to build a fully functional application.

DETECTED APP TYPE: ${appFeatures.appType.toUpperCase()}
DETECTED FEATURES: ${featuresList}

Based on the app type, generate appropriate sections:

## FOR ALL APP TYPES, INCLUDE:

### 1. Project Overview
- App name, purpose, target users
- Core value proposition
- Key differentiators

### 2. Tech Stack (Be specific)
- Framework: Next.js 14+ App Router
- Styling: Tailwind CSS + shadcn/ui components
- State: React hooks, Zustand or Context for global state
- Database: Recommend appropriate DB (Postgres, MongoDB, etc.)
- Auth: NextAuth.js or Clerk
- API: tRPC or REST API routes
- Deployment: Vercel/Railway

### 3. Application Architecture
- File/folder structure
- Route hierarchy (app router pages)
- Component organization
- Shared utilities and hooks

### 4. Database Schema (if applicable)
- Data models with fields and types
- Relationships between models
- Indexes for performance

### 5. All Pages & Routes
List EVERY page the app needs:
- Public pages (landing, pricing, about, etc.)
- Auth pages (login, signup, forgot password)
- Protected pages (dashboard, settings, profile)
- Feature-specific pages

### 6. Component Library
- Reusable UI components needed
- Component props and variants
- Composition patterns

### 7. Features Implementation
For EACH detected feature, provide:
- How it works
- Components involved
- API endpoints needed
- State management approach

### 8. API Endpoints
List all backend routes:
- Auth endpoints
- CRUD endpoints for each resource
- Utility endpoints (search, upload, etc.)
- Request/response shapes

### 9. User Flows
Describe key user journeys:
- Onboarding flow
- Core feature usage
- Settings/profile management

### 10. State Management
- Global state needs
- Server state (React Query/SWR patterns)
- Form state handling

### 11. Styling System
- Color palette (with hex codes)
- Typography scale
- Spacing system
- Component variants

### 12. Responsive Design
- Breakpoint strategy
- Mobile-first patterns
- Touch interactions

### 13. Error Handling
- Error boundaries
- API error handling
- User-friendly error messages
- Loading states

### 14. Security Considerations
- Input validation
- CSRF protection
- Rate limiting
- Data sanitization

### 15. Performance Optimizations
- Image optimization
- Code splitting
- Caching strategies
- Lazy loading

### 16. Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast

### 17. Testing Strategy
- Unit tests for utilities
- Component tests
- E2E test scenarios

### 18. Implementation Order
Step-by-step build sequence:
1. Project setup & dependencies
2. Database & auth setup
3. Core layouts & navigation
4. Feature implementation order
5. Polish & optimization

CRITICAL RULES:
1. Be EXHAUSTIVE - cover every aspect of the application
2. Be SPECIFIC - include actual code patterns, not just descriptions
3. Be PRACTICAL - focus on working solutions
4. NEVER just describe a landing page - describe the FULL APP
5. Include both frontend AND backend requirements
6. Provide actual data models, not just concepts

LEGAL REMINDER:
- Create ORIGINAL content and branding
- Use placeholder text and images
- Recreate STRUCTURE and FUNCTIONALITY, not proprietary content`;

  const userPrompt = `Analyze this ${appFeatures.appType} application and create a COMPREHENSIVE implementation prompt:

**Intent:** ${intentDescriptions[intent]}

**App Analysis:**
- Title: ${content.title}
- Description: ${content.description}
- App Type: ${appFeatures.appType}
- Detected Features: ${featuresList}

**Navigation Structure:**
${content.navigation.join(', ') || 'Not detected'}

**Internal Routes Found:**
${content.internalLinks.slice(0, 20).join(', ') || 'Not detected'}

**Headings (Content Structure):**
${content.headings.slice(0, 20).join(' | ')}

**UI Patterns Detected:**
${content.detectedPatterns.join(', ') || 'Standard patterns'}

**Data Patterns:**
${content.dataPatterns.join(', ') || 'None detected'}

**Forms Found:**
${content.forms.map(f => `${f.type}: [${f.fields.join(', ')}]`).join('\n') || 'None'}

**CTAs/Actions:**
${content.buttons.slice(0, 10).join(', ')}

**Page Sections:**
${content.sections.map(s => `- ${s.type}: ${s.content.substring(0, 150)}`).join('\n')}

**Footer Links:**
${content.footer.slice(0, 15).join(', ')}

---

Now generate the COMPLETE implementation blueprint. Remember:
- This is a ${appFeatures.appType} app, so include ALL relevant features
- Cover frontend, backend, database, and deployment
- Be specific enough that an AI can build the entire app
- Include actual schemas, routes, and component structures`;

  try {
    console.log('Calling Claude API with model:', MODEL);
    console.log('API key configured:', !!apiKey);
    console.log('App type detected:', appFeatures.appType);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.5,
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
      : `App type: ${appFeatures.appType}. Features: ${featuresList}. Standard modern web app architecture applied.`;

    return {
      prompt: textContent,
      assumptions
    };
  } catch (error) {
    console.error('Claude API Error Details:', error);

    if (error instanceof Anthropic.APIError) {
      console.error('API Error Status:', error.status);
      console.error('API Error Message:', error.message);

      // Return detailed error
      throw new Error(`Claude API error (${error.status}): ${error.message}`);
    }

    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again with a simpler page.');
    }

    // Handle connection timeout from Anthropic SDK
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new Error('Claude API request timed out. Please try again.');
    }

    throw error;
  }
}
