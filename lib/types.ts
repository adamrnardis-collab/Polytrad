// Type definitions for PromptMirror

export interface ExtractedContent {
  title: string;
  description: string;
  headings: string[];
  navigation: string[];
  sections: Section[];
  buttons: string[];
  forms: FormInfo[];
  footer: string[];
  detectedPatterns: string[];
}

export interface Section {
  type: string; // hero, features, testimonials, pricing, faq, blog, etc.
  content: string;
}

export interface FormInfo {
  action: string;
  fields: string[];
}

export type InputMode = 'url' | 'html';
export type BuildIntent = 'clone' | 'modernize' | 'saas';

export interface GenerateRequest {
  content: ExtractedContent;
  intent: BuildIntent;
}

export interface GenerateResponse {
  prompt: string;
  assumptions: string;
  extractedSummary: string;
}
