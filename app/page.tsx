'use client';

import { useState } from 'react';
import type { InputMode, BuildIntent, ExtractedContent } from '@/lib/types';

export default function Home() {
  const [mode, setMode] = useState<InputMode>('url');
  const [urlInput, setUrlInput] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [intent, setIntent] = useState<BuildIntent>('clone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [prompt, setPrompt] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [summary, setSummary] = useState('');

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setContent(null);

    try {
      const response = await fetch('/api/fetchPage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch page');
      }

      setContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch page');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractFromHTML = () => {
    if (!htmlInput.trim()) {
      setError('Please paste some HTML');
      return;
    }

    setLoading(true);
    setError(null);

    // Import extraction function dynamically
    import('@/lib/extractFromHtml').then(({ extractFromHtml }) => {
      try {
        const extracted = extractFromHtml(htmlInput);
        setContent(extracted);
      } catch (err) {
        setError('Failed to parse HTML');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleGenerate = async () => {
    if (!content) {
      setError('Please fetch or extract content first');
      return;
    }

    setLoading(true);
    setError(null);
    setPrompt('');
    setAssumptions('');
    setSummary('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, intent }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate prompt');
      }

      setPrompt(data.prompt);
      setAssumptions(data.assumptions);
      setSummary(data.extractedSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">PromptMirror</h1>
          <p className="text-gray-600">
            Generate vibe-coding prompts for Cursor, v0, Lovable, Replit
          </p>
        </header>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('url')}
              className={`px-4 py-2 rounded ${
                mode === 'url'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              URL
            </button>
            <button
              onClick={() => setMode('html')}
              className={`px-4 py-2 rounded ${
                mode === 'html'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Paste HTML
            </button>
          </div>

          {/* URL Mode */}
          {mode === 'url' && (
            <div>
              <label className="block text-sm font-medium mb-2">Website URL</label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border rounded mb-3"
              />
              <button
                onClick={handleFetch}
                disabled={loading || !urlInput.trim()}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Fetching...' : 'Fetch & Extract'}
              </button>
            </div>
          )}

          {/* HTML Mode */}
          {mode === 'html' && (
            <div>
              <label className="block text-sm font-medium mb-2">Paste HTML</label>
              <textarea
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder="<html>...</html>"
                rows={8}
                className="w-full px-4 py-2 border rounded mb-3 font-mono text-sm"
              />
              <button
                onClick={handleExtractFromHTML}
                disabled={loading || !htmlInput.trim()}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                Extract Content
              </button>
            </div>
          )}

          {/* Success Message */}
          {content && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 text-sm">
                ✓ Content extracted: <strong>{content.title}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Generation Section */}
        {content && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <label className="block text-sm font-medium mb-2">Build Intent</label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value as BuildIntent)}
              className="w-full px-4 py-2 border rounded mb-4"
            >
              <option value="clone">Clone Structure Closely</option>
              <option value="modernize">Modernize Design</option>
              <option value="saas">Turn into SaaS Landing</option>
            </select>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded hover:bg-purple-700 disabled:bg-gray-400"
            >
              {loading ? 'Generating...' : 'Generate Prompt'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {prompt && (
          <div className="space-y-6">
            {/* Extraction Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-3">Extraction Summary</h2>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</pre>
            </div>

            {/* Assumptions */}
            {assumptions && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-3">Assumptions / Notes</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{assumptions}</p>
              </div>
            )}

            {/* Generated Prompt */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold">Vibe-Coding Prompt</h2>
                <button
                  onClick={() => copyToClipboard(prompt)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy to Clipboard
                </button>
              </div>
              <pre className="bg-gray-50 p-4 rounded border text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {prompt}
              </pre>
            </div>

            {/* Legal Reminder */}
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800 text-sm">
                <strong>⚠️ Legal Reminder:</strong> This prompt is for inspiration and development assistance.
                Do not copy proprietary content, branding, or designs without permission.
                You are responsible for ensuring compliance with copyright and terms of service.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
