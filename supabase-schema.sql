-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to create the table.
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

-- Optional: index for faster search
create index if not exists idx_show_results_pcci_no on show_results(pcci_no);
create index if not exists idx_show_results_show_date on show_results(show_date);
create index if not exists idx_show_results_breed on show_results(breed);
