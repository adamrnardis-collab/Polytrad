// Prompt Builder - Generate final vibe-coding prompts

import type { ExtractedContent, WebsiteDNA, RebuildSpec, UserGoal } from './types';

/**
 * Build a comprehensive prompt for vibe-coding tools (v0, Cursor, Lovable, Replit)
 */
export function buildVibePrompt(
  content: ExtractedContent,
  dna: WebsiteDNA,
  spec: RebuildSpec,
  goal: UserGoal,
  customGoal?: string
): string {
  const goalDescriptions = {
    clone: 'Create a faithful recreation of the original website structure and design',
    modernize: 'Modernize the design while preserving the core structure and content hierarchy',
    'saas-landing': 'Transform into a modern SaaS landing page with conversion-focused elements',
    custom: customGoal || 'Custom transformation'
  };

  const sections: string[] = [];

  // Header
  sections.push(`# Website Rebuild Specification`);
  sections.push(`\n## Objective\n${goalDescriptions[goal]}\n`);

  // Original Website DNA
  sections.push(`## Original Website DNA`);
  sections.push(`\n**Title:** ${content.title}`);
  sections.push(`\n**Structure & Tone:**`);
  sections.push(`- ${dna.structure}`);
  sections.push(`- Tone: ${dna.tone}`);
  if (dna.colorScheme) sections.push(`- Color Scheme: ${dna.colorScheme}`);
  if (dna.typography) sections.push(`- Typography: ${dna.typography}`);

  sections.push(`\n**UX Patterns:**`);
  dna.uxPatterns.forEach(pattern => sections.push(`- ${pattern}`));

  sections.push(`\n**UI Components Identified:**`);
  dna.uiComponents.forEach(comp => sections.push(`- ${comp}`));

  // Tech Stack
  sections.push(`\n## Technology Stack`);
  sections.push(`
- **Framework:** Next.js 14+ with App Router
- **Styling:** Tailwind CSS
- **Components:** Use shadcn/ui OR build plain React components (your choice)
- **TypeScript:** Strongly typed throughout
- **Deployment:** Optimized for Vercel or similar platforms
`);

  // Routes & Pages
  sections.push(`## Routes & Pages\n`);
  if (spec.routes.length > 0) {
    spec.routes.forEach(route => {
      sections.push(`### \`${route.path}\``);
      sections.push(`${route.description}\n`);
    });
  } else {
    sections.push(`### \`/\` (Homepage)`);
    sections.push(`Main landing page with all extracted content.\n`);
  }

  // Components
  sections.push(`## Component Architecture\n`);
  if (spec.components.length > 0) {
    spec.components.forEach(comp => {
      sections.push(`### ${comp.name}`);
      sections.push(`**Responsibility:** ${comp.responsibility}`);
      if (comp.props && comp.props.length > 0) {
        sections.push(`**Props:** ${comp.props.join(', ')}`);
      }
      sections.push('');
    });
  } else {
    sections.push(`Create components as needed based on the structure analysis.`);
  }

  // Content Strategy
  sections.push(`## Content Strategy\n`);
  if (content.headings.length > 0) {
    sections.push(`**Key Headings:**`);
    content.headings.slice(0, 10).forEach(h => {
      sections.push(`- ${h.text} (H${h.level})`);
    });
    sections.push('');
  }

  if (content.ctaButtons.length > 0) {
    sections.push(`**Call-to-Action Buttons:**`);
    content.ctaButtons.slice(0, 5).forEach(cta => {
      sections.push(`- "${cta}"`);
    });
    sections.push('');
  }

  sections.push(`**Copy Guidelines:**`);
  sections.push(`- Reuse extracted copy where appropriate and legally permissible`);
  sections.push(`- Use placeholder text (lorem ipsum) for content not extracted`);
  sections.push(`- Maintain the original tone: ${dna.tone}`);
  sections.push('');

  // Responsive Behavior
  sections.push(`## Responsive Design Requirements\n`);
  if (spec.responsiveBehavior.length > 0) {
    spec.responsiveBehavior.forEach(rule => sections.push(`- ${rule}`));
  } else {
    sections.push(`- Mobile-first approach with breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)`);
    sections.push(`- Navigation collapses to hamburger menu on mobile`);
    sections.push(`- Grid layouts adjust from multi-column to single column on small screens`);
    sections.push(`- Touch-friendly tap targets (min 44x44px)`);
  }
  sections.push('');

  // Styling Rules
  sections.push(`## Styling Guidelines\n`);
  if (spec.stylingRules.length > 0) {
    spec.stylingRules.forEach(rule => sections.push(`- ${rule}`));
  } else {
    sections.push(`- Use Tailwind utility classes throughout`);
    sections.push(`- Consistent spacing scale: 4, 8, 16, 24, 32, 48, 64px`);
    sections.push(`- Smooth transitions and hover states on interactive elements`);
    sections.push(`- Focus states for accessibility (ring-2 ring-offset-2)`);
  }
  sections.push('');

  // Accessibility
  sections.push(`## Accessibility Checklist\n`);
  sections.push(`- [ ] Semantic HTML elements (header, nav, main, footer, article)`);
  sections.push(`- [ ] Proper heading hierarchy (h1 → h2 → h3)`);
  sections.push(`- [ ] Alt text for all images`);
  sections.push(`- [ ] ARIA labels where needed`);
  sections.push(`- [ ] Keyboard navigation support`);
  sections.push(`- [ ] Focus visible on all interactive elements`);
  sections.push(`- [ ] Color contrast ratios meet WCAG AA standards`);
  sections.push('');

  // Assets
  sections.push(`## Images & Assets\n`);
  sections.push(`- Use placeholder images from Unsplash or placeholder.com`);
  sections.push(`- Next.js Image component for optimization`);
  sections.push(`- Icons: Use Lucide React or Heroicons`);
  sections.push(`- Lazy load images below the fold`);
  sections.push('');

  // Implementation Notes
  sections.push(`## Implementation Instructions\n`);
  sections.push(`1. **Don't over-engineer:** Build only what's specified, avoid premature optimization`);
  sections.push(`2. **Start with structure:** Layout first, then styling, then interactions`);
  sections.push(`3. **Component reusability:** Extract repeated patterns into components`);
  sections.push(`4. **Type safety:** Define TypeScript interfaces for all props and data`);
  sections.push(`5. **Performance:** Use Next.js built-in optimizations (Image, Link, lazy loading)`);
  sections.push(`6. **Testing readiness:** Structure code to be easily testable`);
  sections.push('');

  // Step-by-step checklist
  sections.push(`## Development Checklist\n`);
  sections.push(`- [ ] Set up Next.js project with TypeScript and Tailwind`);
  sections.push(`- [ ] Create folder structure (app/, components/, lib/)`);
  sections.push(`- [ ] Build layout.tsx with global structure`);
  sections.push(`- [ ] Implement each route/page as specified`);
  sections.push(`- [ ] Create reusable components`);
  sections.push(`- [ ] Add responsive breakpoints`);
  sections.push(`- [ ] Implement accessibility features`);
  sections.push(`- [ ] Test on mobile, tablet, desktop viewports`);
  sections.push(`- [ ] Optimize images and assets`);
  sections.push(`- [ ] Review and refactor`);
  sections.push('');

  // Disclaimer
  sections.push(`## Legal & Ethical Note\n`);
  sections.push(`This specification is for inspiration and learning purposes. Reproducing commercial websites may violate terms of service, copyright, or trademark laws. Always ensure you have proper authorization before deploying similar designs.`);
  sections.push('');

  return sections.join('\n');
}

/**
 * Create a system prompt for generating website DNA
 */
export function getWebsiteDNAPrompt(content: ExtractedContent, goal: UserGoal): string {
  return `Analyze this website content and extract its "DNA" - the core characteristics that define its design and user experience.

WEBSITE CONTENT:
Title: ${content.title}
Structure: ${JSON.stringify(content.structure)}
Headings: ${content.headings.slice(0, 10).map(h => `H${h.level}: ${h.text}`).join(', ')}
Navigation: ${content.navigation.join(', ')}
CTAs: ${content.ctaButtons.join(', ')}

USER GOAL: ${goal}

Extract and return JSON with:
{
  "structure": "Brief description of page structure and layout",
  "uxPatterns": ["Pattern 1", "Pattern 2", ...],
  "uiComponents": ["Component 1", "Component 2", ...],
  "tone": "Professional/Casual/Technical/Friendly/etc",
  "colorScheme": "Inferred or suggested color palette",
  "typography": "Typography style and hierarchy"
}

Be specific and actionable. Focus on what makes this site unique.`;
}

/**
 * Create a system prompt for generating rebuild specification
 */
export function getRebuildSpecPrompt(content: ExtractedContent, dna: WebsiteDNA, goal: UserGoal): string {
  return `Create a technical rebuild specification for recreating this website.

WEBSITE DNA:
${JSON.stringify(dna, null, 2)}

EXTRACTED CONTENT:
${JSON.stringify(content, null, 2)}

USER GOAL: ${goal}

Return JSON with:
{
  "routes": [{"path": "/", "description": "Homepage with..."}],
  "components": [{"name": "Header", "responsibility": "...", "props": ["..."]}],
  "dataModels": ["User", "Post", ...],
  "stylingRules": ["Use consistent spacing...", ...],
  "responsiveBehavior": ["Mobile nav collapses...", ...]
}

Be comprehensive but practical. Focus on modern Next.js patterns.`;
}

/**
 * Create a critique prompt
 */
export function getCritiquePrompt(originalSpec: string, competitorName: string): string {
  return `Review this website rebuild specification created by ${competitorName}.

SPECIFICATION:
${originalSpec}

Provide a constructive critique in JSON format:
{
  "strengths": ["What was done well"],
  "weaknesses": ["What could be improved"],
  "suggestions": ["Specific improvements"],
  "missingElements": ["Important things that were missed"]
}

Be specific, actionable, and fair. Focus on completeness, clarity, and technical accuracy.`;
}

/**
 * Create prompt for refining the final vibe prompt
 */
export function getRefinementPrompt(vibePrompt: string): string {
  return `Refine this coding prompt to make it clearer, more actionable, and easier for an AI coding assistant to follow.

ORIGINAL PROMPT:
${vibePrompt}

Improve:
1. Clarity and specificity
2. Step-by-step structure
3. Technical accuracy
4. Completeness of instructions
5. Remove ambiguity

Return the improved version directly (not JSON). Keep the same overall structure but enhance the language.`;
}
