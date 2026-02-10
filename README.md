# PCCI Show Results

Search [PCCI](https://www.pcci.org.ph) dog show results by **breed**, **show date**, and **PCCI No.**, and tally points per dog—without manual Google Sheets or uploading PDFs to GPT.

## Two screens

- **Public (/**): Search, tally, and view results. Share this URL with users.
- **Admin (/admin)**: Upload, scrape, and transform data. Add results, import from spreadsheet, extract from PCCI PDF. Keep this URL private.

## Features

- **Search & Tally**: Filter by breed, PCCI No., and date range. View total points per PCCI No.
- **Data Admin** (add, import, extract): Add single results, paste from Google Sheets, or extract from PCCI result PDFs.
- **Export to CSV**: Download all results (in Admin).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Data is stored in `data/results.json` (no database required for local use).

---

## Deploy online (Vercel + Supabase)

**→ See [DEPLOY.md](DEPLOY.md) for step-by-step signup and deployment instructions.**

Quick outline:

To have the app **accessible on the internet** with **persistent storage** (so data isn’t lost on serverless):

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In the SQL Editor, run the contents of **`supabase-schema.sql`** to create the `show_results` table.
3. In **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   For server-side (API routes), also copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret).

### 2. Deploy to Vercel

1. Push this repo to GitHub (if you haven’t already).
2. Go to [vercel.com](https://vercel.com), sign in, and **Import** the repo.
3. In the project’s **Settings → Environment Variables**, add:

   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key  
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service_role key (for API routes)

4. Redeploy. Your app will be live at `https://your-project.vercel.app` and will use Supabase for storage.

### 3. PDF extraction

- **Extract from PDF** uses the PCCI result PDF URL and tries to parse tables (or text) into rows. If a PDF layout doesn’t match, you can still add results manually or paste from your sheet.
- On Vercel, the first extraction might be slower (cold start); large PDFs may hit the function timeout—extract one show at a time if needed.

### Optional: run without a database

If you deploy to Vercel **without** Supabase env vars, the app still runs but uses in-memory/file storage that **does not persist** between serverless invocations. So for a real online app, use Supabase (or another database) as above.
