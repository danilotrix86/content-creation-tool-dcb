-- Run in Supabase SQL editor or via CLI when ready.
alter table public.generated_articles
  add column if not exists article_type text,
  add column if not exists keyword_intent text,
  add column if not exists article_strategy jsonb;
