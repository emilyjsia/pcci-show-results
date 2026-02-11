# Deploy PCCI Show Results to the Web

This guide walks you through hosting the app online with **Vercel** (hosting) and **Supabase** (database). Both have free tiers.

---

## Part 1: Supabase (Database)

Supabase stores your show results so they persist online. Without it, data would be lost when the server restarts.

### 1.1 Create a Supabase account

1. Go to **[supabase.com](https://supabase.com)** and click **Start your project**.
2. Sign up with GitHub, Google, or email.
3. Verify your email if prompted.

### 1.2 Create a new project

1. Click **New Project**.
2. **Name:** e.g. `pcci-show-results`.
3. **Database Password:** Create a strong password and **save it** somewhere safe (you won’t need it for this app, but keep it for recovery).
4. **Region:** Choose one close to you (e.g. `Southeast Asia (Singapore)` if you’re in the Philippines).
5. Click **Create new project** and wait 1–2 minutes.

### 1.3 Create the table

1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Copy the contents of `supabase-schema.sql` from this project (or the SQL below).
4. Paste into the editor and click **Run**.

```sql
create table if not exists show_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  show_date text not null,
  show_name text not null,
  breed text not null,
  pcci_no text not null,
  dog_name text,
  points integer not null default 0,
  placement text
);

create index if not exists idx_show_results_pcci_no on show_results(pcci_no);
create index if not exists idx_show_results_show_date on show_results(show_date);
create index if not exists idx_show_results_breed on show_results(breed);
```

You should see “Success. No rows returned.”

### 1.4 Get your API keys

1. Go to **Project Settings** (gear icon in the left sidebar).
2. Open **API**.
3. Copy and save:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
   - **service_role** key (another long string) — keep this **secret**; it bypasses Row Level Security

---

## Part 2: Vercel (Hosting)

Vercel hosts your app and serves it over the internet.

### 2.1 Create a Vercel account

1. Go to **[vercel.com](https://vercel.com)** and click **Sign Up**.
2. Sign up with GitHub (recommended for easy deploys).
3. Authorize Vercel to access your GitHub account.

### 2.2 Push your code to GitHub (if you haven’t)

1. Create a new repo at [github.com/new](https://github.com/new), e.g. `pcci-show-results`.
2. In your project folder, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pcci-show-results.git
git push -u origin main
```

### 2.3 Import and deploy

1. In Vercel, click **Add New** → **Project**.
2. **Import** the `pcci-show-results` (or your repo) from GitHub.
3. Click **Import** (keep default settings).
4. Before deploying, open **Environment Variables**.
5. Add these variables (replace with your actual values):

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase **Project URL** | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase **anon public** key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase **service_role** key | Production, Preview, Development |
| `OPENAI_API_KEY` | (Optional) OpenAI API key for PDF extraction fallback | Production, Preview, Development |

6. Click **Deploy**.

Deployment usually takes 1–2 minutes. When it finishes, you’ll get a URL like `https://pcci-show-results-xxx.vercel.app`.

---

## Part 3: Using the deployed app

- **Public URL (e.g. `https://your-app.vercel.app`):** Share this with users. It shows the **Search & Tally** screen only.
- **Admin URL (e.g. `https://your-app.vercel.app/admin`):** Use this yourself for data management. Don’t share it publicly. Here you can:
  - Add single results
  - Import from spreadsheet (paste from Google Sheets)
  - Extract from PCCI PDF
  - View and extract from the PCCI shows list
  - Export all data to CSV

---

## Troubleshooting

**“No results” after deploy**
- The Supabase table starts empty. Add data in `/admin` (add, import, or extract).

**Environment variables not working**
- In Vercel: **Project** → **Settings** → **Environment Variables**. Ensure all three variables are set for Production.
- Redeploy after changing env vars: **Deployments** → three dots on latest → **Redeploy**.

**PDF Extract fails**
- PCCI PDFs can vary in layout. The app first tries a layout-based parser; if it finds no rows, it can use an **AI fallback** when `OPENAI_API_KEY` is set in Vercel. Add that env var (from [platform.openai.com](https://platform.openai.com/api-keys)) and redeploy to enable it. Otherwise, add results manually or paste from your spreadsheet in Admin.
