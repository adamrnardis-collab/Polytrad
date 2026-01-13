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
  // App-level analysis
  appFeatures: AppFeatures;
  internalLinks: string[];
  dataPatterns: string[];
}

export interface Section {
  type: string; // hero, features, testimonials, pricing, faq, blog, dashboard, settings, etc.
  content: string;
}

export interface FormInfo {
  action: string;
  fields: string[];
  type: 'login' | 'signup' | 'contact' | 'search' | 'settings' | 'crud' | 'other';
}

export interface AppFeatures {
  hasAuth: boolean;
  hasDashboard: boolean;
  hasUserProfile: boolean;
  hasSettings: boolean;
  hasSearch: boolean;
  hasCRUD: boolean;
  hasDataTables: boolean;
  hasCharts: boolean;
  hasNotifications: boolean;
  hasFileUpload: boolean;
  hasRealtime: boolean;
  hasPagination: boolean;
  hasFiltering: boolean;
  hasSorting: boolean;
  appType: 'landing' | 'webapp' | 'dashboard' | 'ecommerce' | 'blog' | 'portfolio' | 'saas' | 'unknown';
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
