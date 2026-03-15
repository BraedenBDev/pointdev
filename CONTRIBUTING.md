# Contributing to PointDev

PointDev is open source under the MIT license. Contributions are welcome.

## Development Setup

```bash
git clone https://github.com/almostalab/pointdev.git
cd pointdev
bun install
bun dev
```

This starts Vite in watch mode. Load the `dist/` folder as an unpacked extension in Chrome (`chrome://extensions/` → Developer Mode → Load unpacked).

Changes to sidepanel code may hot-reload depending on the build configuration (CRXJS plugin supports HMR; manual builds require manual reload). Changes to the content script or service worker always require clicking the refresh button on the extension card in `chrome://extensions/`.

## Project Structure

```
src/
├── sidepanel/       # React UI (capture controls + output view)
├── background/      # MV3 service worker (state coordination)
├── content/         # Content script (element selection, canvas, cursor tracking)
└── shared/          # Types, message definitions, formatter
```

## What to Contribute

**Capture layers** — new types of context the extension can capture (e.g., accessibility tree, performance metrics, network state).

**Output format adapters** — new ways to format the compiled output (e.g., JSON, GitHub issue template, Markdown).

**Framework adapters** — component name resolution for Vue, Svelte, or other frameworks (following the React inspector pattern in `src/content/react-inspector.ts`).

**Bug fixes and UX improvements** — especially around cross-site compatibility, annotation accuracy, and transcription handling.

## Commit Conventions

- Write clear commit messages describing *why*, not just *what*
- AI-assisted commits must include a `Co-Authored-By` tag
- Keep commits focused — one logical change per commit

## Testing

```bash
bun test          # Run unit tests
bun test:watch    # Watch mode
```

Extension integration testing is manual: load the unpacked extension, test on various web pages, verify the compiled output is correct and useful.

## Code Style

- TypeScript strict mode
- No `any` types without justification
- Prefer explicit types over inference for function signatures
- ESLint + Prettier enforced via pre-commit hook
