create table public.ai_calls (
  id           uuid        primary key default uuid_generate_v4(),
  project_id   text,                        -- local nanoid string, no FK
  iteration_id text,
  step         text        not null
               check (step in (
                 'vision_detection','verdict','generation',
                 'iteration','audit','repair',
                 'embedding','scraping_lbc','matching','other'
               )),
  provider     text        not null,
  model        text,
  input_tokens  int,
  output_tokens int,
  images_in    int         not null default 0,
  images_out   int         not null default 0,
  api_requests int         not null default 1,
  unit_cost    numeric,
  total_cost   numeric     not null default 0,
  latency_ms   int,
  success      boolean     not null default true,
  error        text,
  created_at   timestamptz not null default now()
);

create index idx_ai_calls_created  on public.ai_calls(created_at desc);
create index idx_ai_calls_project  on public.ai_calls(project_id);
create index idx_ai_calls_step     on public.ai_calls(step, created_at desc);

-- Service role only — no RLS policies = anonymous/auth roles cannot access
alter table public.ai_calls enable row level security;
