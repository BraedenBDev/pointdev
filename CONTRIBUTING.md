# Contributing to PointDev

PointDev is an NLnet-funded open source project building in the open under the MIT license. Contributions are welcome.

## Quick Start

```bash
git clone https://github.com/BraedenBDev/pointdev.git
cd pointdev
bun install
bun dev
```

This starts Vite in watch mode. Load `dist/` as an unpacked extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** and select the `dist/` folder

Changes to sidepanel code may hot-reload. Changes to the content script or service worker require clicking the refresh button on the extension card in `chrome://extensions/`.

## Testing

```bash
bun test              # Run unit tests (Vitest)
bunx vitest run       # Same thing, explicit
bun test:watch        # Watch mode
```

Extension integration testing is manual: load the unpacked extension and test on various web pages. There is no automated E2E test harness for the extension itself.

## Code Style

- TypeScript strict mode
- ESLint + Prettier enforced: run `bun lint` before submitting
- No `any` types without justification
- Prefer explicit types over inference for function signatures

## Commit Conventions

- Write clear commit messages describing *why*, not just *what*
- One logical change per commit
- AI-assisted commits must include: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

## Architecture

PointDev is a Chrome MV3 extension with four cooperating contexts: sidepanel (React UI), service worker (state coordinator), content script (DOM capture), and shared modules (types, messages, formatter).

See `CLAUDE.md` for the full architecture overview, message flow, key technical details, and permission model.

## Finding Work

Check [GitHub Issues](https://github.com/BraedenBDev/pointdev/issues) for open tasks. Look for issues labeled **good first issue** and **help wanted**.
