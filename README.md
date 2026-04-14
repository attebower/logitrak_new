# LogiTrak

LogiTrak is a SaaS logistics management platform built with Next.js, Supabase, and Stripe.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (Postgres) |
| ORM | Prisma |
| Auth | NextAuth.js |
| Payments | Stripe |
| Deployment | Vercel |
| CI | GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier works)
- A Stripe account (test mode for development)

### Local Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/[org]/logitrak.git
   cd logitrak
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `.env.local` with your values. See `.env.example` for documentation on each variable.

4. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   App runs at [http://localhost:3000](http://localhost:3000).

## Branch Strategy

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production-ready code | logitrak.app (manual trigger) |
| `staging` | Pre-production QA | staging.logitrak.app |
| `dev` | Active development | — |
| `feature/*` | Feature branches | Vercel preview URL |

**Rules:**
- Never push directly to `main`. All changes via PR + review.
- `dev` is the default working branch.
- Every PR gets an automatic Vercel preview deployment.

## CI/CD

GitHub Actions runs on every push and PR:

1. **Typecheck** — `tsc --noEmit`
2. **Lint** — ESLint (zero warnings policy)
3. **Build** — `next build`

CI must pass before any PR can be merged.

## Environment Variables

See `.env.example` for the full list of required variables with documentation.

**Never commit `.env.local` or any file containing real secrets.**

## Deployment

Production deploys are triggered manually via Vercel after:
- All CI checks pass
- Scout (QA) has approved the PR
- Manual review of pre-production checklist

## Contributing

1. Branch from `dev`
2. Open a PR against `dev`
3. CI must pass
4. Request review
5. Merge only after approval
