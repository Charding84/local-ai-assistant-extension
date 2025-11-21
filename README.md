# Local AI Assistant Extension

**Privacy-first, local-only Chrome extension** that feels like AI using deterministic transforms, lightweight NLP in web workers, and an IndexedDB-backed dashboard.

## ✨ Key Features

- **🔒 Privacy-First**: Zero external API calls by default. All processing happens locally.
- **⚡ High Performance**: Heavy CPU work runs in web workers with strict timeouts (<300ms for ≤500 chars)
- **🎯 Deterministic**: Template-based transforms with no hallucination—outputs are always auditable
- **🛡️ Permission Model**: Disabled on all sites by default. Two-step opt-in required per site.
- **📊 Dashboard**: Full-featured IndexedDB-backed dashboard with search, filters, and export
- **♻️ Undo Stack**: Last 10 actions per site with full undo support

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐               │
│  │   Service    │      │   Content    │               │
│  │   Worker     │◄────►│   Scripts    │               │
│  │ (Background) │      │  (Injected)  │               │
│  └──────┬───────┘      └──────┬───────┘               │
│         │                     │                         │
│         ├─────────────────────┼─────────────────┐      │
│         │                     │                 │      │
│         ▼                     ▼                 ▼      │
│  ┌──────────────┐      ┌──────────────┐  ┌──────────┐ │
│  │  Transform   │      │     NLP      │  │ IndexedDB│ │
│  │    Worker    │      │   Worker     │  │  Storage │ │
│  └──────────────┘      └──────────────┘  └──────────┘ │
│         ▲                     ▲                 ▲      │
│         │                     │                 │      │
│         └─────────────────────┴─────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Dashboard UI + Options              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Components

#### Background Layer
- **Service Worker**: Manages extension lifecycle, permissions, and message routing
- **Action Router**: Routes messages between components

#### Content Layer  
- **Content Bootstrap**: Initializes content scripts only on whitelisted sites
- **Copy Interceptor**: Listens for copy events and triggers rewrite popup
- **Scoped Observer**: Watches DOM changes with strict performance limits

#### Worker Layer
- **Transform Worker**: Deterministic text transforms (length, tone, style)
- **NLP Worker**: Keyword extraction, extractive summarization, scoring

#### Storage Layer
- **IndexedDB**: Stores collections, items, rewrite history, action graphs, undo stacks
- **LRU Cache**: Performance optimization with automatic eviction

#### UI Layer
- **Dashboard**: Search, filter, export, and manage saved content
- **Options Page**: Site permission management and settings
- **Overlays**: Copy-rewrite popup, result cards, command palette

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm or pnpm
- Chrome/Chromium browser

### Installation

```bash
# Clone the repository
git clone https://github.com/Charding84/local-ai-assistant-extension.git
cd local-ai-assistant-extension

# Install dependencies
npm install
# or
pnpm install

# Build the extension
npm run build
```

### Load Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `build/` directory from the project
5. The extension icon should appear in your toolbar

### Development Mode

```bash
# Start dev server (for UI pages)
npm run dev

# Watch mode for auto-rebuild
npm run build -- --watch

# Run tests
npm test

# Run performance tests
npm run perf
```

## 🎯 Usage

### Enabling on a Site

1. Click the extension icon on any website
2. Click **"Enable on this site"**
3. Choose which features to enable:
   - **Copy→Rewrite**: Transform copied text
   - **Observers**: Watch for DOM changes
   - **Autofill**: Smart form filling
4. Reload the page

### Copy→Rewrite

1. Select and copy text on an enabled site
2. A popup appears near your cursor with options:
   - **Length**: Short, Medium, Long, Custom
   - **Tone**: Formal, Casual, Professional
   - **Style**: Concise, Detailed, Technical
3. Preview the transformed text
4. Click **Copy** or **Replace** (requires confirmation)
5. **Undo** restores the previous version

### Dashboard

- Click the extension icon → **"Open Dashboard"**
- Search across all saved items
- Filter by collection, tags, or date
- Export as JSON or CSV
- View action graphs and provenance

## 🔒 Privacy Model

### Default State
- **Zero host permissions** on install
- **No content injection** until explicitly enabled
- **No telemetry** (disabled by default)
- **No external network calls** in core functionality

### Opt-In Flow

1. **User initiates**: Clicks extension icon on specific site
2. **Permission request**: Browser prompts for host permission
3. **Feature selection**: User chooses which features to enable
4. **Confirmation**: Two-step process prevents accidental activation
5. **Revocable**: Can be disabled at any time from options page

### Data Storage

- All data stored locally in **IndexedDB**
- No cloud sync by default
- Export functionality for manual backup
- Automatic retention policy (configurable, default 30 days)

## 🧪 Testing

```bash
# Run all tests
npm run ci

# Unit tests only
npm run test:unit

# Integration tests (requires Chrome)
npm run test:integration

# Performance tests
npm run test:perf

# Lint code
npm run lint
```

### Test Coverage

- **Unit tests**: Template engine, sanitizer, transforms, validators
- **Integration tests**: Opt-in flow, copy-rewrite flow, dashboard CRUD
- **Worker enforcement**: Tests fail if transforms run on main thread
- **Performance gates**: Median latency must be <300ms for ≤500 chars
- **Network isolation**: CI asserts zero outbound calls in core flows

## 📊 Performance Benchmarks

Measured on representative sites (see `tests/perf/sites.json`):

| Metric | Target | Actual |
|--------|--------|--------|
| Transform latency (≤500 chars) | <300ms | ~120ms |
| Worker initialization | <50ms | ~35ms |
| IndexedDB write | <100ms | ~60ms |
| Dashboard load (1000 items) | <500ms | ~380ms |
| Memory overhead | <50MB | ~28MB |

## 🛠️ Development

### Project Structure

```
.
├── manifest.json           # Extension manifest (MV3)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── background/         # Service worker
│   ├── content/            # Content scripts
│   ├── workers/            # Web workers
│   ├── ui/                 # React UI components
│   ├── lib/
│   │   ├── idb/            # IndexedDB layer
│   │   ├── templates/      # Transform templates
│   │   ├── autofill/       # Autofill logic
│   │   └── utils/          # Utilities
│   └── ...
├── tests/
│   ├── unit/
│   ├── integration/
│   └── perf/
├── scripts/                # Build scripts
├── docs/                   # Documentation
└── build/                  # Distribution files
```

### Adding New Transforms

1. Edit `src/workers/transformWorker.ts`
2. Add new lexicon or pattern to `TONE_LEXICONS` or `STYLE_PATTERNS`
3. Add unit test in `tests/unit/transformWorker.test.ts`
4. Update documentation

### Adding New Features

1. Update `manifest.json` if new permissions needed
2. Add feature flag to storage schema
3. Implement in appropriate layer (content/worker/UI)
4. Add tests for new functionality
5. Update README and documentation

## 📋 Acceptance Criteria Checklist

- [x] Default extension injects nowhere, zero host permissions
- [x] Two-step per-site opt-in implemented and tested
- [x] All heavy text processing runs in workers with timeouts
- [x] Local transform median latency <300ms for ≤500 chars
- [x] Copy→rewrite overlay editable with provenance
- [x] Autofill requires explicit confirm, no auto-submit
- [x] Undo stack retains last 10 actions per site
- [x] Dashboard supports search, filters, export
- [x] CI asserts zero outbound network calls
- [x] Telemetry off by default

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure CI passes
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Privacy Model](docs/PRIVACY.md)
- [Performance Report](docs/PERFORMANCE.md)
- [GitHub Repository](https://github.com/Charding84/local-ai-assistant-extension)

## ⚠️ Security

To report security vulnerabilities, please email charding405@gmail.com

Do NOT open public issues for security concerns.
