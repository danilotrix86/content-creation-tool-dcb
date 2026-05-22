-- Job state for phased article generation (browser-orchestrated steps).
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  phase text not null default 'research_serp',
  input jsonb not null,
  state jsonb not null default '{}'::jsonb,
  error text,
  result_id uuid references public.generated_articles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_status_idx on public.generation_jobs (status);
create index if not exists generation_jobs_created_at_idx on public.generation_jobs (created_at desc);
