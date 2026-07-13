# Dear Hiring Manager - AI Cover Letter Generator

**Sprint 4 SaaS Utility** · Vanilla HTML / CSS / JavaScript · No framework, no build step

Turn a candidate's role, skills, job description, and résumé into a ready-to-send cover letter - as a hardcoded simulation, a live Gemini AI draft, or a fully résumé-personalized letter. Styled like an actual typed letter on paper, not a generic form-in-a-box.

## Features

-  Form-driven letter generation - name, role, company, key skills, job description
-  Two compose modes: instant **template** draft, or **Gemini AI**-written draft
-  Résumé PDF upload - text is extracted client-side and folded into the AI prompt for a personalized letter
-  One-click **Copy to clipboard**
-  API key kept out of source control via a git-ignored `config.js`

## Project structure

ai-cover-letter-generator/
├── index.html            # Markup: form, letter preview, phase legend
├── style.css             # Design system (paper/letterhead visual language)
├── app.js                # All three phases' logic
├── config.js             # YOUR real key - created locally, git-ignored
├── .gitignore            # Excludes config.js from version control
└── README.md

## Troubleshooting

| Message | What it means | Fix |
|---|---|---|
| `models/gemini-1.5-flash is not found for API version v1beta` | That model generation has been fully retired by Google. | Use `gemini-flash-latest` in `config.js` - already the default in `config.example.js`. |
| `This model ... is no longer available to new users` | Google closed that specific model to new API keys/projects. | The app auto-retries with `gemini-3.5-flash` → `gemini-3.1-flash-lite` → `gemini-2.5-flash`. Update `GEMINI_MODEL` if you want to pin a specific one you know you have access to. |
| `This model is currently experiencing high demand. Please try again later.` | A transient `503`/`429` from Google - the free-tier model is temporarily overloaded or you've hit a per-minute rate limit. Not a bug in the app or your key. | Wait 10–30 seconds and click **Compose letter** again. |
| Résumé upload does nothing | Page opened via `file://` instead of a local server. | Serve the folder (`python3 -m http.server`) so the PDF worker and `fetch` calls can run. |
| Copy button does nothing | Browser blocked clipboard access (usually on non-HTTPS/non-localhost origins). | Serve over `localhost` or HTTPS. |

## Tech stack

- **Fonts:** Fraunces (display), Inter (UI), Space Mono (letter body / typewriter feel) - Google Fonts
- **AI:** [Gemini API](https://ai.google.dev/) (`generateContent`), free tier
- **PDF parsing:** [pdf.js](https://mozilla.github.io/pdf.js/) (Mozilla), loaded from cdnjs, runs entirely client-side
- **Markdown rendering:** [marked.js](https://marked.js.org/), loaded from cdnjs
- **No frameworks, no bundler** — everything is vanilla JS in an IIFE in `app.js`

## Author

Nayan Gupta
