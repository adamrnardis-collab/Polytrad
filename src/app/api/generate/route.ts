// API Route: /api/generate
// Orchestrate Claude + ChatGPT debate pipeline

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import { getCached, setCached } from '@/lib/cache';
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

    // Check API keys (OpenAI is optional)
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    console.log('Running with:', hasOpenAI ? 'Claude + GPT' : 'Claude only');

    // Check cache first (saves ~$0.12 per hit)
    const cachedResult = getCached(content, goal, customGoal);
    if (cachedResult) {
      console.log('Returning cached result for:', content.title);
      return NextResponse.json(
        {
          success: true,
          result: cachedResult,
          cached: true,
        },
        {
          headers: {
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'X-Cache': 'HIT',
          },
        }
      );
    }

    console.log('Starting generation pipeline for:', content.title);

    let websiteDNA: WebsiteDNA;
    let claudeRebuildSpec: RebuildSpec;
    let gptRebuildSpec: RebuildSpec;
    let claudeCritique: Critique;
    let gptCritique: Critique;
    let mergedSpec: RebuildSpec;

    if (hasOpenAI) {
      // Full pipeline with Claude + GPT debate
      console.log('Step 1: Generating Website DNA (Claude + GPT)...');
      const dnaPrompt = getWebsiteDNAPrompt(content, goal);

      const [claudeDNA, gptDNA] = await Promise.allSettled([
        generateWebsiteDNAWithClaude(dnaPrompt),
        generateWebsiteDNAWithGPT(dnaPrompt),
      ]);

      if (claudeDNA.status === 'rejected' && gptDNA.status === 'rejected') {
        throw new Error('Both models failed to generate Website DNA');
      }

      websiteDNA = claudeDNA.status === 'fulfilled'
        ? claudeDNA.value
        : gptDNA.status === 'fulfilled'
        ? gptDNA.value
        : { structure: '', uxPatterns: [], uiComponents: [], tone: '' };

      console.log('Step 2: Generating Rebuild Specs (Claude + GPT)...');
      const specPrompt = getRebuildSpecPrompt(content, websiteDNA, goal);

      const [claudeSpec, gptSpec] = await Promise.allSettled([
        generateRebuildSpecWithClaude(specPrompt),
        generateRebuildSpecWithGPT(specPrompt),
      ]);

      claudeRebuildSpec = claudeSpec.status === 'fulfilled'
        ? claudeSpec.value
        : { routes: [], components: [], stylingRules: [], responsiveBehavior: [] };

      gptRebuildSpec = gptSpec.status === 'fulfilled'
        ? gptSpec.value
        : { routes: [], components: [], stylingRules: [], responsiveBehavior: [] };

      console.log('Step 3: Running cross-critique (Claude vs GPT)...');
      const [claudeCritiqueResult, gptCritiqueResult] = await Promise.allSettled([
        generateCritiqueWithClaude(
          getCritiquePrompt(JSON.stringify(gptRebuildSpec, null, 2), 'ChatGPT')
        ),
        generateCritiqueWithGPT(
          getCritiquePrompt(JSON.stringify(claudeRebuildSpec, null, 2), 'Claude')
        ),
      ]);

      claudeCritique = claudeCritiqueResult.status === 'fulfilled'
        ? claudeCritiqueResult.value
        : { strengths: [], weaknesses: [], suggestions: [], missingElements: [] };

      gptCritique = gptCritiqueResult.status === 'fulfilled'
        ? gptCritiqueResult.value
        : { strengths: [], weaknesses: [], suggestions: [], missingElements: [] };

      console.log('Step 4: Merging specifications...');
      mergedSpec = mergeSpecs(claudeRebuildSpec, gptRebuildSpec, claudeCritique, gptCritique);

    } else {
      // Simplified Claude-only pipeline
      console.log('Step 1: Generating Website DNA (Claude only)...');
      const dnaPrompt = getWebsiteDNAPrompt(content, goal);
      websiteDNA = await generateWebsiteDNAWithClaude(dnaPrompt);

      console.log('Step 2: Generating Rebuild Spec (Claude only)...');
      const specPrompt = getRebuildSpecPrompt(content, websiteDNA, goal);
      claudeRebuildSpec = await generateRebuildSpecWithClaude(specPrompt);

      console.log('Step 3: Running self-critique (Claude)...');
      claudeCritique = await generateCritiqueWithClaude(
        getCritiquePrompt(JSON.stringify(claudeRebuildSpec, null, 2), 'the initial analysis')
      );

      // Apply critique improvements
      const improvementPrompt = `Based on this critique, improve the rebuild specification:

ORIGINAL SPEC:
${JSON.stringify(claudeRebuildSpec, null, 2)}

CRITIQUE:
${JSON.stringify(claudeCritique, null, 2)}

Return an improved version of the specification as JSON. Address the weaknesses and incorporate the suggestions.`;

      const improvedSpec = await generateRebuildSpecWithClaude(improvementPrompt);

      mergedSpec = improvedSpec;
      gptRebuildSpec = { routes: [], components: [], stylingRules: [], responsiveBehavior: [] };
      gptCritique = { strengths: [], weaknesses: [], suggestions: [], missingElements: [] };
    }

    // Step 4/5: Generate initial vibe prompt
    const stepNum = hasOpenAI ? 5 : 4;
    console.log(`Step ${stepNum}: Building vibe prompt v1...`);
    const promptV1 = buildVibePrompt(content, websiteDNA, mergedSpec, goal, customGoal);

    // Step 5/6: Refine prompt
    const refineStepNum = hasOpenAI ? 6 : 5;
    console.log(`Step ${refineStepNum}: Refining final prompt...`);
    const refinementPrompt = getRefinementPrompt(promptV1);

    let promptFinal: string;

    if (hasOpenAI) {
      // Parallel refinement with both models
      const [claudeRefined, gptRefined] = await Promise.allSettled([
        refinePromptWithClaude(refinementPrompt),
        refinePromptWithGPT(refinementPrompt),
      ]);

      // Use the better refinement (prefer Claude, fallback to GPT, then original)
      promptFinal = claudeRefined.status === 'fulfilled'
        ? claudeRefined.value
        : gptRefined.status === 'fulfilled'
        ? gptRefined.value
        : promptV1;
    } else {
      // Claude-only refinement
      promptFinal = await refinePromptWithClaude(refinementPrompt);
    }

    const processingTime = Date.now() - startTime;

    console.log(`Generation complete in ${processingTime}ms`);

    // Step 6/7: Return complete result
    const modelsUsed = hasOpenAI
      ? ['claude-3-5-sonnet-20241022', process.env.OPENAI_MODEL || 'gpt-4o-mini']
      : ['claude-3-5-sonnet-20241022'];

    const result: GenerationResult = {
      websiteDNA,
      rebuildSpec: mergedSpec,
      promptV1,
      claudeCritique,
      gptCritique,
      promptFinal,
      metadata: {
        processingTime,
        modelsUsed,
      },
    };

    // Cache the result for future requests (saves ~$0.12 per hit)
    setCached(content, goal, result, customGoal);

    return NextResponse.json(
      {
        success: true,
        result,
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('generate error:', error);

    // Provide detailed error messages
    if (error instanceof Error) {
      // Extract useful information from error message
      const errorMessage = error.message;

      // Check for common error patterns
      if (errorMessage.includes('invalid JSON') || errorMessage.includes('JSON')) {
        return NextResponse.json(
          {
            error: 'AI Response Format Error',
            message: 'One of the AI models returned an invalid response. Please try again. If the issue persists, the website content may be too complex.',
            details: errorMessage.substring(0, 200)
          },
          { status: 500 }
        );
      }

      if (errorMessage.includes('API key')) {
        return NextResponse.json(
          { error: 'Configuration Error', message: 'API keys are not properly configured on the server.' },
          { status: 500 }
        );
      }

      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return NextResponse.json(
          { error: 'Timeout Error', message: 'The request took too long. Please try again with a simpler page.' },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { error: 'Generation failed', message: errorMessage.substring(0, 300) },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred', message: 'Please try again or contact support if the issue persists.' },
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
