// Core types for Prompt Mirror

export interface ExtractedContent {
  title: string;
  headings: Array<{ level: number; text: string }>;
  paragraphs: string[];
  navigation: string[];
  links: Array<{ text: string; href: string }>;
  ctaButtons: string[];
  metadata: {
    description?: string;
    keywords?: string;
  };
  structure: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasNav: boolean;
    hasSidebar: boolean;
  };
}

export interface WebsiteDNA {
  structure: string;
  uxPatterns: string[];
  uiComponents: string[];
  tone: string;
  colorScheme?: string;
  typography?: string;
}

export interface RebuildSpec {
  routes: Array<{ path: string; description: string }>;
  components: Array<{ name: string; responsibility: string; props?: string[] }>;
  dataModels?: string[];
  stylingRules: string[];
  responsiveBehavior: string[];
}

export interface Critique {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  missingElements: string[];
}

export interface GenerationResult {
  websiteDNA: WebsiteDNA;
  rebuildSpec: RebuildSpec;
  promptV1: string;
  claudeCritique: Critique;
  gptCritique: Critique;
  promptFinal: string;
  metadata: {
    processingTime: number;
    modelsUsed: string[];
  };
  cached?: boolean;
}

export type InputMode = 'url' | 'html' | 'text';
export type UserGoal = 'clone' | 'modernize' | 'saas-landing' | 'custom';

export interface FetchPageRequest {
  mode: InputMode;
  input: string;
}

export interface GenerateRequest {
  content: ExtractedContent;
  goal: UserGoal;
  customGoal?: string;
}
