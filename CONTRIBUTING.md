# Contributing

Thanks for helping improve `vision-review`.

## Quick start

1. Fork and clone your fork.
2. Install Node.js 18.18+ (or newer) and npm 10+.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start local development:
   ```bash
   npm run dev
   ```

## Branch and commit conventions

- Branch naming: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
- Keep pull requests focused and small when possible.
- Use clear commit messages (Conventional Commits are encouraged):
  - `feat: add batch retry for image analysis`
  - `fix: guard against malformed labels payload`

## Quality checks

Run these before opening a pull request:

```bash
npm run check
```

This runs formatting checks, TypeScript checks, and tests.

## Pull request checklist

- [ ] Tests added/updated for behavior changes.
- [ ] `npm run check` passes locally.
- [ ] README/docs updated when behavior or setup changed.
- [ ] No secrets committed.

## Reporting security issues

Please do not open public issues for security vulnerabilities.
Follow the instructions in `SECURITY.md`.
