# PPTX Translator

Translate PowerPoint decks end-to-end with a Vite/React frontend that talks to the translation backend. The app uploads `.pptx` files, sends them to the pipeline, and returns downloadable PPTX (and optional PDF) outputs.

## Local Development
```bash
npm install
npm run dev
```
Set `VITE_BACKEND_URL` if your API runs anywhere other than `http://localhost:8000`.

## Deployment
- Push to `main` to trigger the included GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds the Vite app and publishes to GitHub Pages at `/PPTX-translator/`.
- Ensure the backend is deployed separately and accessible via the URL you configure in `VITE_BACKEND_URL`.
