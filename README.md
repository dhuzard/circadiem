# vision-review

`vision-review` is an open-source module for structured review of circadian activity PNG plots with OpenAI vision models.

It provides:

- A React UI for batch upload and review.
- A Node/Express API for image analysis.
- Structured JSON and CSV export for downstream analysis.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only). See [LICENSE](./LICENSE).

## Repository structure

- `client/`: React + TypeScript + Vite frontend.
- `server/`: Express + TypeScript backend.
- `.github/`: CI and issue/PR templates.

## Requirements

- Node.js `>=18.18.0`
- npm `>=10`

## Quick start

```bash
npm install
npm run dev
```

By default:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5174`

## Production build

```bash
npm run build
npm run start
```

The backend serves both the API and built frontend assets.

## Developer commands

```bash
npm run dev          # run client + server in watch mode
npm run build        # build client and server
npm run test         # run server tests
npm run typecheck    # run TypeScript checks across workspaces
npm run format       # apply Prettier formatting
npm run format:check # check formatting
npm run check        # format:check + typecheck + test
```

## Configuration

Create an `.env` file from `.env.example` if needed:

```bash
cp .env.example .env
```

- `PORT` (optional): Backend port (default `5174`).

OpenAI API keys are provided at runtime through the UI and forwarded as bearer tokens to the local backend. The backend does not persist API keys.

## API

### `GET /health`

Returns service health:

```json
{ "ok": true }
```

### `POST /api/analyze`

Multipart form-data fields:

- `images`: one or more PNG files
- `labels`: JSON array of labels (optional)
- `model`: OpenAI model id (optional, default `gpt-4o-mini`)
- `aligned_to_dark`: `true|false` (optional)

Header:

- `Authorization: Bearer <OPENAI_API_KEY>`

Returns a structured result array, including per-image errors when analysis fails.

## Open-source governance

- [Contributing guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## Creating a new independent repository from this module

1. Copy this folder into an empty directory.
2. Initialize git:
   ```bash
   git init
   git add .
   git commit -m "chore: initialize vision-review"
   ```
3. Create a new GitHub repository and push:
   ```bash
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
4. Update placeholder contact values (for example in `SECURITY.md` and `CODE_OF_CONDUCT.md`).
