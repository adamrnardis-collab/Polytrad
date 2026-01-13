# PromptMirror

A simple prototype tool that analyzes websites and generates high-quality "vibe-coding prompts" for AI coding assistants like Cursor, v0, Lovable, and Replit.

## What It Does

1. User pastes a website URL (or raw HTML)
2. App fetches and extracts the website's structure and content
3. Claude analyzes the site and generates a detailed, copy-ready implementation prompt
4. User copies the prompt and uses it in their favorite AI coding tool

## Features

- ✅ **Secure**: API keys never exposed to browser
- ✅ **Simple**: One-page UI, no accounts needed
- ✅ **Free**: No limits (prototype phase)
- ✅ **SSRF Protected**: Validates URLs and blocks dangerous fetches
- ✅ **Smart Extraction**: Detects heroes, features, pricing, testimonials, etc.
- ✅ **Quality Prompts**: Structured, actionable, immediately usable

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI**: Anthropic Claude API (server-side only)
- **Styling**: Tailwind CSS
- **Parser**: Cheerio (HTML extraction)
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com/))

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/adamrnardis-collab/Polytrad.git
cd Polytrad
npm install
```

### 2. Configure API Key

Create `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your key:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Use the App

1. Choose **URL** or **Paste HTML** mode
2. Enter a website URL (e.g., `https://stripe.com`)
3. Click **Fetch & Extract**
4. Select **Build Intent** (Clone, Modernize, or SaaS)
5. Click **Generate Prompt**
6. Copy the generated prompt and use it in Cursor/v0/etc.

## Project Structure

```
PromptMirror/
├── app/
│   ├── api/
│   │   ├── fetchPage/route.ts    # Secure URL fetching + extraction
│   │   └── generate/route.ts     # Claude prompt generation
│   ├── page.tsx                  # Main UI
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── lib/
│   ├── validateUrl.ts            # SSRF protection
│   ├── extractFromHtml.ts        # Content extraction
│   ├── claude.ts                 # Claude API client (server-only)
│   └── types.ts                  # TypeScript types
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.example
└── README.md
```

## Security Notes

### API Key Protection (CRITICAL)

- ✅ API key stored in `.env.local` (server-side only)
- ✅ Never sent to browser or logged
- ✅ All Claude API calls happen in Next.js API routes
- ✅ Client-side code cannot access the key
- ✅ Webpack configured to prevent accidental leaks

**The `lib/claude.ts` file enforces server-only execution:**

```typescript
if (typeof window !== 'undefined') {
  throw new Error('Claude client must only be used server-side!');
}
```

### SSRF Protection

The app blocks dangerous URL fetching:
- ✅ Only `http://` and `https://` allowed
- ✅ Blocks `localhost`, `127.0.0.1`, `0.0.0.0`
- ✅ Blocks private IP ranges (10.x, 172.16-31.x, 192.168.x)
- ✅ Blocks link-local addresses (169.254.x.x)
- ✅ Blocks cloud metadata endpoints

### Content Extraction

- Strips `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`
- Sanitizes all HTML before processing
- Limits fetched content to 5MB
- 15-second timeout on URL fetches

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | - | Your Anthropic Claude API key |
| `CLAUDE_MODEL` | No | `claude-3-5-sonnet-20241022` | Claude model to use |

## Deployment

### Deploy to Vercel (Recommended)

1. Push to GitHub:

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variable:
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: `sk-ant-...`
5. Click **Deploy**

### Deploy to Netlify

1. Push to GitHub
2. Go to [app.netlify.com](https://app.netlify.com/)
3. Click **Add new site** → **Import an existing project**
4. Select your repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
6. Add environment variable: `ANTHROPIC_API_KEY`
7. Deploy

## API Routes

### POST /api/fetchPage

Fetches and extracts content from a URL.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "content": {
    "title": "Example Site",
    "description": "...",
    "headings": ["..."],
    "navigation": ["..."],
    "sections": [...],
    "buttons": ["..."],
    "forms": [...],
    "footer": ["..."],
    "detectedPatterns": ["Hero section", "Features grid"]
  }
}
```

### POST /api/generate

Generates a vibe-coding prompt.

**Request:**
```json
{
  "content": { /* ExtractedContent */ },
  "intent": "clone" | "modernize" | "saas"
}
```

**Response:**
```json
{
  "success": true,
  "prompt": "# Website Rebuild Specification...",
  "assumptions": "Standard modern web app assumptions...",
  "extractedSummary": "**Title:** Example\n..."
}
```

## Legal & Ethical Disclaimer

**IMPORTANT**: This tool is for inspiration and development assistance only.

- ❌ Do NOT copy proprietary text, images, or branding
- ❌ Do NOT violate copyright or terms of service
- ✅ Recreate **structure and functionality** with **original content**
- ✅ Create a **distinct visual identity**
- ✅ Ensure you have rights to any copied content

**You are responsible for compliance with all applicable laws and terms of service.**

The generated prompts include reminders about legal/ethical requirements.

## Troubleshooting

### "Couldn't fetch this page"

**Solutions:**
1. Use "Paste HTML" mode instead
2. Copy the page source (View → Developer → View Source)
3. Check if the site blocks bots or requires login

### "API key not configured"

**Solutions:**
1. Make sure `.env.local` exists
2. Verify `ANTHROPIC_API_KEY=sk-ant-...` is set correctly
3. Restart the dev server: `npm run dev`

### "Invalid URL"

The URL failed SSRF validation. This is intentional security protection.

**Blocked:**
- localhost / 127.0.0.1
- Private IPs (10.x, 192.168.x)
- Cloud metadata endpoints

## Cost Considerations

### Per Request Cost

- **Fetch + Extract**: Free (runs on your server)
- **Claude API Call**: ~$0.05-0.15 per generation

Average cost per generated prompt: **$0.08**

### Example Monthly Costs

| Usage | Prompts/Month | Cost |
|-------|---------------|------|
| Light | 10 | $0.80 |
| Medium | 50 | $4.00 |
| Heavy | 200 | $16.00 |

## Limitations (Prototype)

- No rate limiting (add for production)
- No caching (repeated URLs cost the same)
- No authentication (add for multi-user)
- No usage analytics
- No prompt history

## Future Enhancements

- [ ] Caching layer (save repeated URLs)
- [ ] Rate limiting (prevent abuse)
- [ ] User accounts (save prompts)
- [ ] Prompt history
- [ ] Batch processing (multiple URLs)
- [ ] Screenshot capture
- [ ] Direct integration with Cursor/v0 APIs

## Contributing

This is a prototype. Contributions welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use for any purpose.

## Support

For issues or questions:
- Open an issue on GitHub
- Contact: adamrnardis-collab

---

**Built with ❤️ using Next.js, Claude, and too much coffee.**
