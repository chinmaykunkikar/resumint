# resumint

AI-powered resume tailoring from your terminal. Analyze job postings, rewrite bullets to match, generate cover letters, and compile polished PDFs.

## Why

Every job application deserves a tailored resume, but manually rewriting bullets for each posting is tedious. resumint automates the boring parts while keeping you in control of the content.

You maintain a single master resume in YAML. resumint analyzes job descriptions, rewrites your bullets to mirror the JD's language, picks the best-fit profile, and compiles a PDF. No fabrication, no hallucinated experience.

## Features

- **JD analysis** - Extracts skills, terminology, seniority level, and domain fit from any job posting
- **Bullet rewriting** - Rephrases your real experience to mirror JD language (never fabricates)
- **Profile matching** - Auto-selects the best resume profile for each role
- **Cover letters** - Generates tailored cover letters that reference specific JD requirements
- **LinkedIn outreach** - Creates personalized connection notes and follow-up messages
- **URL scraping** - Paste a job posting URL and resumint extracts the description automatically
- **Caching** - Reuses analysis results for duplicate URLs across commands
- **Iterative revision** - Review the generated PDF and request changes in a feedback loop
- **Dual LLM backend** - Works with the Anthropic API or Claude Code CLI

## Prerequisites

- **Node.js** >= 18
- **LaTeX** distribution with `pdflatex` (e.g., [TeX Live](https://tug.org/texlive/), [MacTeX](https://tug.org/mactex/))
- **One of:**
  - `ANTHROPIC_API_KEY` environment variable (uses Anthropic API directly)
  - [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (uses `claude -p` as backend)

## Install

```bash
npm install -g resumint
```

## Quick Start

```bash
# 1. Initialize project structure with sample data
resumint init

# 2. Edit with your real resume data
#    - data/master-resume.yaml  (all your experience, projects, skills)
#    - data/profiles/           (curated subsets for different role types)

# 3. Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# 4. Generate a tailored resume
resumint quick https://example.com/job-posting
```

## Commands

### Core workflow

| Command | Description |
|---------|-------------|
| `resumint init` | Create data directories and sample YAML files |
| `resumint quick [url]` | Quick match: paste JD, auto-select profile, generate PDF |
| `resumint customize [url]` | Deep customization: JD analysis, bullet rewriting, diff review, PDF |
| `resumint generate <company>` | Re-generate PDF for a saved company |

### Analysis & outreach

| Command | Description |
|---------|-------------|
| `resumint analyze [url]` | Standalone JD analysis (skills, fit, terminology) |
| `resumint cover-letter [url]` | Generate a tailored cover letter |
| `resumint reachout [url]` | Generate LinkedIn connection note + follow-up message |

### Company management

| Command | Description |
|---------|-------------|
| `resumint company add [url]` | Save a target company and its JD |
| `resumint company list` | List saved companies |
| `resumint company show <slug>` | Show company details and resume versions |
| `resumint company remove <slug>` | Remove a saved company |

### Other

| Command | Description |
|---------|-------------|
| `resumint profiles` | List available resume profiles |

All commands that accept a `[url]` will auto-scrape the job description. You can also paste the JD text directly when prompted.

## Project Structure

```
data/
  master-resume.yaml    # All your experience (the single source of truth)
  profiles/             # Curated subsets (frontend-heavy.yaml, fullstack.yaml, etc.)
  companies/            # Saved company JDs and customized resume data
  output/               # Generated .tex and .pdf files
  voice.yaml            # Writing style profile for cover letters/outreach
config.yaml             # LLM model, LaTeX command, default profile
```

## Configuration

`config.yaml` controls runtime settings:

```yaml
anthropicModel: claude-sonnet-4-20250514   # Model for API backend
maxTokens: 4096
latexCommand: pdflatex                      # Or full path: /Library/TeX/texbin/pdflatex
defaultProfile: frontend-heavy
outputDir: data/output
```

## How It Works

1. **Master resume** - You write all your experience once in `data/master-resume.yaml`. Every bullet, project, and skill lives here.
2. **Profiles** - Each profile is a curated view: which summary, which bullets, which skills to include. Think of it as a lens on the same data.
3. **JD analysis** - resumint parses the job description and classifies each required skill as EXACT match, ADJACENT (same ecosystem), LEARNABLE, or DOMAIN_CHANGE.
4. **Bullet rewriting** - In `customize` mode, each bullet is rewritten to naturally incorporate the JD's terminology without fabricating experience.
5. **PDF compilation** - The final resume is compiled to PDF via LaTeX, and you can iteratively revise it in a feedback loop.

## License

MIT
