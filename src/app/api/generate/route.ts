// API Route: /api/generate
// Orchestrate Claude + ChatGPT debate pipeline

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import {
  generateWebsiteDNAWithClaude,
  generateRebuildSpecWithClaude,
  generateCritiqueWithClaude,
  refinePromptWithClaude,
} from '@/lib/anthropic';
import {
  generateWebsiteDNAWithGPT,
  generateRebuildSpecWithGPT,
  generateCritiqueWithGPT,
  refinePromptWithGPT,
} from '@/lib/openai';
import {
  getWebsiteDNAPrompt,
  getRebuildSpecPrompt,
  getCritiquePrompt,
  getRefinementPrompt,
  buildVibePrompt,
} from '@/lib/promptBuilder';
import type {
  GenerateRequest,
  WebsiteDNA,
  RebuildSpec,
  Critique,
  GenerationResult,
} from '@/lib/types';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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
    let body: GenerateRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { content, goal, customGoal } = body;

    // Validate input
    if (!content || !goal) {
      return NextResponse.json(
        { error: 'Missing required fields: content and goal' },
        { status: 400 }
      );
    }

    // Check API keys
    if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: API keys not configured' },
        { status: 500 }
      );
    }

    console.log('Starting generation pipeline for:', content.title);

    // Step 1: Generate Website DNA in parallel (Claude + GPT)
    console.log('Step 1: Generating Website DNA...');
    const dnaPrompt = getWebsiteDNAPrompt(content, goal);

    const [claudeDNA, gptDNA] = await Promise.allSettled([
      generateWebsiteDNAWithClaude(dnaPrompt),
      generateWebsiteDNAWithGPT(dnaPrompt),
    ]);

    // Handle failures
    if (claudeDNA.status === 'rejected' && gptDNA.status === 'rejected') {
      throw new Error('Both models failed to generate Website DNA');
    }

    const websiteDNA: WebsiteDNA = claudeDNA.status === 'fulfilled'
      ? claudeDNA.value
      : gptDNA.status === 'fulfilled'
      ? gptDNA.value
      : { structure: '', uxPatterns: [], uiComponents: [], tone: '' };

    // Step 2: Generate Rebuild Specs in parallel (Claude + GPT)
    console.log('Step 2: Generating Rebuild Specs...');
    const specPrompt = getRebuildSpecPrompt(content, websiteDNA, goal);

    const [claudeSpec, gptSpec] = await Promise.allSettled([
      generateRebuildSpecWithClaude(specPrompt),
      generateRebuildSpecWithGPT(specPrompt),
    ]);

    const claudeRebuildSpec: RebuildSpec = claudeSpec.status === 'fulfilled'
      ? claudeSpec.value
      : { routes: [], components: [], stylingRules: [], responsiveBehavior: [] };

    const gptRebuildSpec: RebuildSpec = gptSpec.status === 'fulfilled'
      ? gptSpec.value
      : { routes: [], components: [], stylingRules: [], responsiveBehavior: [] };

    // Step 3: Cross-critique (Claude critiques GPT, GPT critiques Claude)
    console.log('Step 3: Running cross-critique...');
    const [claudeCritiqueResult, gptCritiqueResult] = await Promise.allSettled([
      generateCritiqueWithClaude(
        getCritiquePrompt(JSON.stringify(gptRebuildSpec, null, 2), 'ChatGPT')
      ),
      generateCritiqueWithGPT(
        getCritiquePrompt(JSON.stringify(claudeRebuildSpec, null, 2), 'Claude')
      ),
    ]);

    const claudeCritique: Critique = claudeCritiqueResult.status === 'fulfilled'
      ? claudeCritiqueResult.value
      : { strengths: [], weaknesses: [], suggestions: [], missingElements: [] };

    const gptCritique: Critique = gptCritiqueResult.status === 'fulfilled'
      ? gptCritiqueResult.value
      : { strengths: [], weaknesses: [], suggestions: [], missingElements: [] };

    // Step 4: Merge specs (deterministic best-of-both approach)
    console.log('Step 4: Merging specifications...');
    const mergedSpec = mergeSpecs(claudeRebuildSpec, gptRebuildSpec, claudeCritique, gptCritique);

    // Step 5: Generate initial vibe prompt
    console.log('Step 5: Building vibe prompt v1...');
    const promptV1 = buildVibePrompt(content, websiteDNA, mergedSpec, goal, customGoal);

    // Step 6: Refine prompt in parallel (Claude + GPT)
    console.log('Step 6: Refining final prompt...');
    const refinementPrompt = getRefinementPrompt(promptV1);

    const [claudeRefined, gptRefined] = await Promise.allSettled([
      refinePromptWithClaude(refinementPrompt),
      refinePromptWithGPT(refinementPrompt),
    ]);

    // Use the better refinement (prefer Claude, fallback to GPT, then original)
    const promptFinal = claudeRefined.status === 'fulfilled'
      ? claudeRefined.value
      : gptRefined.status === 'fulfilled'
      ? gptRefined.value
      : promptV1;

    const processingTime = Date.now() - startTime;

    console.log(`Generation complete in ${processingTime}ms`);

    // Step 7: Return complete result
    const result: GenerationResult = {
      websiteDNA,
      rebuildSpec: mergedSpec,
      promptV1,
      claudeCritique,
      gptCritique,
      promptFinal,
      metadata: {
        processingTime,
        modelsUsed: ['claude-3-5-sonnet-20241022', 'gpt-4'],
      },
    };

    return NextResponse.json(
      {
        success: true,
        result,
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        },
      }
    );
  } catch (error) {
    console.error('generate error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Generation failed', message: error.message },
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
 * Merge Claude and GPT specs using deterministic rules
 */
function mergeSpecs(
  claudeSpec: RebuildSpec,
  gptSpec: RebuildSpec,
  claudeCritique: Critique,
  gptCritique: Critique
): RebuildSpec {
  // Routes: combine and deduplicate
  const routesMap = new Map<string, { path: string; description: string }>();

  for (const route of claudeSpec.routes) {
    routesMap.set(route.path, route);
  }

  for (const route of gptSpec.routes) {
    if (!routesMap.has(route.path)) {
      routesMap.set(route.path, route);
    } else {
      // Merge descriptions
      const existing = routesMap.get(route.path)!;
      existing.description = `${existing.description} | ${route.description}`;
    }
  }

  const routes = Array.from(routesMap.values());

  // Components: combine and deduplicate by name
  const componentsMap = new Map<string, any>();

  for (const comp of claudeSpec.components) {
    componentsMap.set(comp.name, comp);
  }

  for (const comp of gptSpec.components) {
    if (!componentsMap.has(comp.name)) {
      componentsMap.set(comp.name, comp);
    }
  }

  const components = Array.from(componentsMap.values());

  // Styling rules: combine unique rules
  const stylingRules = Array.from(
    new Set([...claudeSpec.stylingRules, ...gptSpec.stylingRules])
  );

  // Responsive behavior: combine unique behaviors
  const responsiveBehavior = Array.from(
    new Set([...claudeSpec.responsiveBehavior, ...gptSpec.responsiveBehavior])
  );

  // Data models: combine if present
  const dataModels = Array.from(
    new Set([...(claudeSpec.dataModels || []), ...(gptSpec.dataModels || [])])
  );

  // Apply critiques to improve merged spec
  // Add missing elements from critiques
  for (const missing of claudeCritique.missingElements) {
    if (missing.toLowerCase().includes('component')) {
      components.push({
        name: missing,
        responsibility: 'Identified during critique',
      });
    }
  }

  return {
    routes,
    components,
    dataModels: dataModels.length > 0 ? dataModels : undefined,
    stylingRules,
    responsiveBehavior,
  };
}
