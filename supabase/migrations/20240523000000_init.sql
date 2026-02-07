-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Data Rooms table
create table data_rooms (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id) not null,
  name text not null,
  status text default 'active', -- 'active', 'archived'
  created_at timestamptz default now()
);

-- Folders table
create table folders (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  parent_id uuid references folders(id),
  name text not null,
  access_level text default 'standard', -- 'standard', 'sensitive', 'restricted'
  created_at timestamptz default now()
);

-- Documents table
create table documents (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id) not null,
  folder_id uuid references folders(id),
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  page_count int,
  status text default 'processing', -- 'processing', 'ready', 'error'
  created_at timestamptz default now()
);

-- Shared Links table
create table shared_links (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references data_rooms(id),
  document_id uuid references documents(id),
  slug text unique not null,
  settings jsonb default '{}'::jsonb, 
  -- { "require_email": true, "expiration": "...", "allow_download": false, "watermark_text": "{email} - {ip}" }
  permissions jsonb default '{}'::jsonb,
  -- { "allowed_folders": ["folder_id_1", "folder_id_2"], "access_tier": "all" }
  created_by uuid references profiles(id) not null,
  is_active boolean default true,
  view_count int default 0,
  created_at timestamptz default now()
);

-- Link Access Logs table
create table link_access_logs (
  id uuid default gen_random_uuid() primary key,
  link_id uuid references shared_links(id) not null,
  visitor_email text, -- Captured if gating is on
  visitor_session_token text, -- Cookie value hash
  ip_address text,
  user_agent text,
  geo_location jsonb,
  started_at timestamptz default now(),
  last_active_at timestamptz default now()
);

-- Document Analytics table
create table document_analytics (
  id uuid default gen_random_uuid() primary key,
  access_log_id uuid references link_access_logs(id) not null,
  document_id uuid references documents(id) not null,
  page_number int not null,
  duration_seconds float not null, -- Time spent on this page
  viewed_at timestamptz default now()
);

-- RLS Policies (Placeholder - strict deny by default)
alter table profiles enable row level security;
alter table data_rooms enable row level security;
alter table folders enable row level security;
alter table documents enable row level security;
alter table shared_links enable row level security;
alter table link_access_logs enable row level security;
alter table document_analytics enable row level security;
