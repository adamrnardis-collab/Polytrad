# Prompt Mirror

AI-powered website analysis tool that uses **both Claude and ChatGPT** to generate comprehensive rebuild specifications and vibe-coding prompts. Perfect for creating prompts for v0, Cursor, Lovable, Replit, and other AI coding assistants.

## Features

- **Dual AI Analysis**: Leverages both Claude (Anthropic) and ChatGPT (OpenAI) for comprehensive insights
- **Debate Pipeline**: Models critique each other's outputs for higher quality results
- **Security First**: SSRF protection, rate limiting, no client-side API keys
- **Multiple Input Modes**: URL fetching, HTML paste, or plain text
- **Flexible Goals**: Clone structure, modernize design, create SaaS landing, or custom transformations
- **Production Ready**: Built with Next.js 14, TypeScript, and Tailwind CSS

## What It Does

1. **Fetch & Extract**: Securely fetches a webpage and extracts clean content (structure, copy, components)
2. **Generate DNA**: Both AI models analyze the website's design patterns and UX
3. **Create Specs**: Both models independently generate rebuild specifications
4. **Cross-Critique**: Claude critiques GPT's output, GPT critiques Claude's output
5. **Merge**: Combines best elements from both specifications
6. **Build Prompt**: Generates a comprehensive vibe-coding prompt
7. **Refine**: Both models refine the prompt for maximum clarity
8. **Output**: Final prompt ready to paste into your favorite AI coding tool

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API + OpenAI API
- **Content Parsing**: Cheerio
- **Deployment**: Vercel-ready

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Anthropic API key ([get one here](https://console.anthropic.com/)) - **REQUIRED**
- OpenAI API key ([get one here](https://platform.openai.com/)) - **OPTIONAL** (for enhanced quality)

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/adamrnardis-collab/Polytrad.git
cd Polytrad
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
# REQUIRED: Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-api03-...

# OPTIONAL: OpenAI API Key (for enhanced quality via dual-model debate)
# Leave empty to run Claude-only mode (25% cheaper)
OPENAI_API_KEY=

# Optional: Rate limiting (requests per IP per hour)
RATE_LIMIT_PER_HOUR=10

# Optional: Max fetch size in bytes (default: 2MB)
MAX_FETCH_SIZE=2097152

# Optional: Model configurations
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
OPENAI_MODEL=gpt-4
```

4. **Run the development server**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Basic Workflow

1. **Choose Input Mode**
   - **URL**: Enter a website URL to fetch and analyze
   - **HTML**: Paste raw HTML content
   - **Text**: Paste plain text content

2. **Fetch Content**
   - Click "Fetch & Extract" to safely retrieve and parse the content
   - The app extracts headings, navigation, copy, structure, and more

3. **Select Goal**
   - **Clone Structure**: Recreate the original design faithfully
   - **Modernize**: Update the design while preserving core structure
   - **Make it SaaS Landing**: Transform into a conversion-focused SaaS page
   - **Custom**: Define your own transformation goal

4. **Generate Prompt**
   - Click "Generate Prompt" to start the AI pipeline
   - This takes 30-60 seconds (both models + debate + refinement)

5. **Review Results**
   - View the final vibe-coding prompt
   - Explore Website DNA, Rebuild Spec, and AI critiques
   - Copy the final prompt to your clipboard

6. **Use in AI Coding Tools**
   - Paste the prompt into v0, Cursor, Lovable, Replit, or similar tools
   - The prompt includes step-by-step instructions, component specs, and best practices

## Project Structure

```
Polytrad/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fetchPage/route.ts    # Secure URL fetching + extraction
│   │   │   └── generate/route.ts     # AI debate pipeline orchestration
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home page
│   │   └── globals.css               # Global styles
│   ├── components/
│   │   └── PromptMirror.tsx          # Main UI component
│   └── lib/
│       ├── anthropic.ts              # Claude API client (server-only)
│       ├── openai.ts                 # OpenAI API client (server-only)
│       ├── ssrfProtection.ts         # SSRF prevention utilities
│       ├── rateLimiter.ts            # IP-based rate limiting
│       ├── contentExtractor.ts       # HTML content extraction
│       ├── promptBuilder.ts          # Prompt generation logic
│       └── types.ts                  # TypeScript interfaces
├── .env.example                      # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## Security Features

### 1. API Keys Protection

- **Server-Only**: All API keys are stored server-side via environment variables
- **Never Exposed**: Keys never appear in client bundles, logs, or network responses
- **No Client Access**: All AI calls happen in Next.js API routes (server-side)

### 2. SSRF Protection

- **Protocol Validation**: Only `http://` and `https://` allowed
- **Blocked Hosts**: Prevents access to localhost, 127.0.0.1, and private IPs
- **IP Range Filtering**: Blocks private networks (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- **Metadata Endpoints**: Blocks cloud provider metadata IPs (AWS, GCP, Azure)
- **Redirect Validation**: Re-validates URLs after following redirects

### 3. Rate Limiting

- **IP-Based**: Limits requests per IP address per hour
- **Configurable**: Set `RATE_LIMIT_PER_HOUR` environment variable
- **Default**: 10 requests per hour per IP
- **Headers**: Returns `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers

### 4. Input Validation

- **Size Limits**: Maximum 2MB for fetched content (configurable)
- **Content Sanitization**: Strips `<script>`, `<style>`, `<iframe>`, event handlers
- **Timeout Protection**: 15-second timeout on URL fetches, 60-second timeout on AI calls
- **Type Validation**: Validates request payloads and content types

### 5. Abuse Prevention

- **Request Size Limits**: Prevents memory exhaustion attacks
- **Token Limits**: Hard limits on AI model token usage
- **Error Handling**: Safe error messages that don't leak sensitive info
- **Logging**: Minimal logging (no full page content or API responses)

## Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy to Vercel**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

- Connect your GitHub repository
- Vercel will auto-detect Next.js
- Add environment variables in Vercel dashboard:
  - `ANTHROPIC_API_KEY` (required)
  - `OPENAI_API_KEY` (optional - for dual-model mode)
  - `RATE_LIMIT_PER_HOUR` (optional)
  - `MAX_FETCH_SIZE` (optional)

3. **Deploy**

Vercel will build and deploy automatically.

### Deploy to Other Platforms

The app is a standard Next.js application and can be deployed to:

- **Netlify**: Use Next.js Runtime
- **Railway**: Add environment variables in dashboard
- **Fly.io**: Use Next.js Dockerfile
- **Self-hosted**: Build with `npm run build` and run with `npm start`

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | - | Your Anthropic Claude API key |
| `OPENAI_API_KEY` | **No** | - | Your OpenAI API key (optional, for dual-model mode) |
| `RATE_LIMIT_PER_HOUR` | No | `10` | Requests allowed per IP per hour |
| `MAX_FETCH_SIZE` | No | `2097152` | Max bytes to fetch from URLs (2MB) |
| `ANTHROPIC_MODEL` | No | `claude-3-5-sonnet-20241022` | Claude model to use |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model to use (if OpenAI key provided) |
| `ENABLE_CACHE` | No | `true` | Enable caching for repeated requests |

## API Routes

### POST /api/fetchPage

Securely fetch and extract content from a URL, HTML, or text.

**Request Body:**

```json
{
  "mode": "url" | "html" | "text",
  "input": "string"
}
```

**Response:**

```json
{
  "success": true,
  "content": {
    "title": "string",
    "headings": [...],
    "paragraphs": [...],
    "navigation": [...],
    "links": [...],
    "ctaButtons": [...],
    "metadata": {...},
    "structure": {...}
  }
}
```

### POST /api/generate

Run the full AI debate pipeline to generate a vibe-coding prompt.

**Request Body:**

```json
{
  "content": { /* ExtractedContent object */ },
  "goal": "clone" | "modernize" | "saas-landing" | "custom",
  "customGoal": "string" // if goal is "custom"
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "websiteDNA": {...},
    "rebuildSpec": {...},
    "promptV1": "string",
    "claudeCritique": {...},
    "gptCritique": {...},
    "promptFinal": "string",
    "metadata": {
      "processingTime": 45000,
      "modelsUsed": ["claude-3-5-sonnet-20241022", "gpt-4"]
    }
  }
}
```

## Cost Considerations

### Claude-Only Mode (Simplest & Cheapest)

**~$0.09 per request** - Just add `ANTHROPIC_API_KEY`!

- **No OpenAI API key needed**
- Claude handles DNA, Spec, Critique, and Refinement
- Self-improvement through iterative critique
- Excellent quality for most use cases
- Perfect for getting started

### Dual-Model Mode (Enhanced Quality)

**~$0.12 per request** - Add both API keys for debate pipeline

- Claude + GPT-4o-mini cross-validation
- Different model perspectives improve coverage
- Debate/critique identifies blind spots
- Best for production use

### Cost Comparison

| Configuration | Per Request | 1,000 Requests/Month | Quality | API Keys Needed |
|--------------|-------------|---------------------|---------|-----------------|
| **Claude Only** | **$0.09** | **$90** | ⭐⭐⭐⭐ | Anthropic only |
| **Claude + GPT-4o-mini** | **$0.12** | **$120** | ⭐⭐⭐⭐⭐ | Anthropic + OpenAI |
| Claude + GPT-4 | $0.67 | $670 | ⭐⭐⭐⭐⭐ | Anthropic + OpenAI |

### Cache Savings

- **First request**: $0.09-0.12 (depending on mode)
- **Repeated requests (within 1 hour)**: $0 (instant, cached)
- **Average with 30% cache hit rate**: $0.06-0.08 per request

### How to Configure

**Claude-Only (Recommended to Start):**
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=  # Leave empty
```

**Dual-Model (Enhanced Quality):**
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # Add for debate pipeline
OPENAI_MODEL=gpt-4o-mini  # Or gpt-4 for max quality
```

**See [COST_OPTIMIZATION.md](./COST_OPTIMIZATION.md) for detailed cost analysis and strategies.**

## Legal & Ethical Considerations

This tool is designed for **inspiration and learning purposes**.

**Important Notes:**

- Reproducing commercial websites may violate copyright, trademark, or terms of service
- Always ensure you have proper authorization before deploying similar designs
- Use generated prompts as a starting point, not a copy-paste solution
- Respect intellectual property rights
- The tool includes a disclaimer in the UI and generated prompts

## Troubleshooting

### "API keys not configured" error

- Ensure `.env.local` exists and contains valid API keys
- Restart the dev server after adding keys
- Check that keys don't have extra spaces or quotes

### "Rate limit exceeded" error

- Wait for the reset time (shown in error message)
- Increase `RATE_LIMIT_PER_HOUR` if you're testing

### "Failed to fetch content" error

- Ensure the URL is valid and publicly accessible
- Some sites block automated requests (use HTML paste mode instead)
- Check SSRF protection isn't blocking valid sites (review console logs)

### AI generation fails

- Verify both API keys are valid and have credits
- Check API status pages (Anthropic and OpenAI)
- Review server logs for detailed error messages

### Build errors

- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (requires 18+)
- Delete `.next` folder and rebuild: `rm -rf .next && npm run build`

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

### Lint Code

```bash
npm run lint
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

### 48-Hour MVP (Current)
- ✅ Basic UI with URL/HTML/text input
- ✅ SSRF protection and rate limiting
- ✅ Claude + ChatGPT debate pipeline
- ✅ Final prompt generation

### Week 1 Improvements
- [ ] Enhanced caching layer (Redis/KV)
- [ ] Session-based rate limiting
- [ ] Progress indicators for long operations
- [ ] Better error recovery and retries
- [ ] More sophisticated merge algorithms
- [ ] A/B testing for different prompt templates

### Future Ideas
- [ ] User authentication and saved projects
- [ ] Historical prompt versions
- [ ] Image analysis for design systems
- [ ] Direct integration with v0/Cursor APIs
- [ ] Team collaboration features
- [ ] Analytics dashboard

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Anthropic Claude](https://www.anthropic.com/) and [OpenAI](https://openai.com/)
- UI styled with [Tailwind CSS](https://tailwindcss.com/)

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: adamrnardis-collab

---

**Disclaimer**: This tool is for educational and inspirational purposes. Always respect intellectual property rights and obtain proper authorization before reproducing website designs.
