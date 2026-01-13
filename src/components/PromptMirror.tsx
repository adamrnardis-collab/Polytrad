'use client';

import { useState } from 'react';
import type { InputMode, UserGoal, ExtractedContent, GenerationResult } from '@/lib/types';

export default function PromptMirror() {
  const [mode, setMode] = useState<InputMode>('url');
  const [input, setInput] = useState('');
  const [goal, setGoal] = useState<UserGoal>('clone');
  const [customGoal, setCustomGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'dna' | 'spec' | 'prompt' | 'critiques'>('prompt');

  const handleFetch = async () => {
    if (!input.trim()) {
      setError('Please enter a URL, HTML, or text');
      return;
    }

    setFetchLoading(true);
    setError(null);
    setContent(null);
    setResult(null);

    try {
      const response = await fetch('/api/fetchPage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, input }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch content');
      }

      setContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!content) {
      setError('Please fetch content first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          goal,
          customGoal: goal === 'custom' ? customGoal : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate prompt');
      }

      setResult({
        ...data.result,
        cached: data.cached || false,
      });
      setActiveTab('prompt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Prompt Mirror
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
          AI-powered website analysis using Claude + ChatGPT
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Generate vibe-coding prompts for v0, Cursor, Lovable, Replit
        </p>
      </header>

      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Input Mode</label>
          <div className="flex gap-2">
            {(['url', 'html', 'text'] as InputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {mode === 'url' ? 'Website URL' : mode === 'html' ? 'HTML Content' : 'Text Content'}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'url'
                ? 'https://example.com'
                : mode === 'html'
                ? 'Paste HTML here...'
                : 'Paste text here...'
            }
            rows={mode === 'url' ? 2 : 6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleFetch}
          disabled={fetchLoading || !input.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {fetchLoading && (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {fetchLoading ? 'Fetching...' : 'Fetch & Extract'}
        </button>

        {content && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              ✓ Content extracted: {content.title}
            </p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-1">
              {content.headings.length} headings, {content.paragraphs.length} paragraphs, {content.links.length} links
            </p>
          </div>
        )}
      </div>

      {/* Generation Section */}
      {content && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as UserGoal)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="clone">Clone Structure</option>
              <option value="modernize">Modernize</option>
              <option value="saas-landing">Make it SaaS Landing</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {goal === 'custom' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Custom Goal</label>
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Describe your goal..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {loading ? 'Generating (30-60s)...' : 'Generate Prompt'}
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Requests are rate-limited. This may take up to a minute.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
          <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
          <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Results</h2>
            <div className="flex items-center gap-3">
              {result.cached && (
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full border border-green-300 dark:border-green-700">
                  ⚡ Cached (Saved ~$0.12)
                </span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {result.cached ? 'Instant' : `Generated in ${(result.metadata.processingTime / 1000).toFixed(1)}s`}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            {[
              { key: 'prompt', label: 'Final Prompt' },
              { key: 'dna', label: 'Website DNA' },
              { key: 'spec', label: 'Rebuild Spec' },
              { key: 'critiques', label: 'Critiques' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'prompt' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-lg">Vibe-Coding Prompt (Final)</h3>
                  <button
                    onClick={() => copyToClipboard(result.promptFinal)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px] text-sm border border-gray-200 dark:border-gray-700">
                  {result.promptFinal}
                </pre>
              </div>
            )}

            {activeTab === 'dna' && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Website DNA</h3>
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px] text-sm border border-gray-200 dark:border-gray-700">
                  {JSON.stringify(result.websiteDNA, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'spec' && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Rebuild Specification</h3>
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px] text-sm border border-gray-200 dark:border-gray-700">
                  {JSON.stringify(result.rebuildSpec, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === 'critiques' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Claude's Critique</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[300px] text-sm border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(result.claudeCritique, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">ChatGPT's Critique</h3>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-[300px] text-sm border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(result.gptCritique, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Legal Notice:</strong> This tool is for inspiration and learning purposes.
              Reproducing commercial websites may violate terms of service, copyright, or trademark laws.
              Always ensure you have proper authorization before deploying similar designs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
