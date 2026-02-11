-- AI Agent Panel: API keys, consent, usage logging, and document text cache

-- Encrypted API keys per user/room/provider
create table if not exists ai_api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  room_id uuid references data_rooms(id) not null,
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  encrypted_key text not null,
  key_hint text, -- last 4 chars for display
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, room_id, provider)
);

-- User consent records for AI features (mirrors nda_acceptances pattern)
create table if not exists ai_consent (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  room_id uuid references data_rooms(id) not null,
  consented_at timestamptz default now(),
  ip_address text,
  unique(user_id, room_id)
);

-- Token usage and cost tracking per interaction
create table if not exists ai_usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  room_id uuid references data_rooms(id) not null,
  provider text not null,
  model text not null,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  total_tokens int default 0,
  created_at timestamptz default now()
);

-- Extracted PDF text cached at upload time
create table if not exists document_text_cache (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents(id) not null unique,
  room_id uuid references data_rooms(id) not null,
  extracted_text text not null,
  page_count int,
  extracted_at timestamptz default now()
);

-- RLS policies
alter table ai_api_keys enable row level security;
alter table ai_consent enable row level security;
alter table ai_usage_logs enable row level security;
alter table document_text_cache enable row level security;

-- ai_api_keys: users can only manage their own keys
create policy "Users manage own AI keys"
  on ai_api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ai_consent: users can only manage their own consent
create policy "Users manage own AI consent"
  on ai_consent for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ai_usage_logs: users can only see their own usage
create policy "Users view own AI usage"
  on ai_usage_logs for select
  using (auth.uid() = user_id);

create policy "Users insert own AI usage"
  on ai_usage_logs for insert
  with check (auth.uid() = user_id);

-- document_text_cache: room members can read cached text
create policy "Room members read document text cache"
  on document_text_cache for select
  using (
    exists (
      select 1 from data_rooms
      where data_rooms.id = document_text_cache.room_id
        and data_rooms.owner_id = auth.uid()
    )
    or exists (
      select 1 from team_members
      where team_members.room_id = document_text_cache.room_id
        and team_members.user_id = auth.uid()
    )
  );

-- Room members can insert/update text cache
create policy "Room members write document text cache"
  on document_text_cache for insert
  with check (
    exists (
      select 1 from data_rooms
      where data_rooms.id = document_text_cache.room_id
        and data_rooms.owner_id = auth.uid()
    )
    or exists (
      select 1 from team_members
      where team_members.room_id = document_text_cache.room_id
        and team_members.user_id = auth.uid()
    )
  );
