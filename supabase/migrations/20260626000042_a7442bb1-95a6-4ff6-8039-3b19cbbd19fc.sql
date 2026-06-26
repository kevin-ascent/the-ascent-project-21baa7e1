
-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_name text,
  faith_tradition text,
  intention text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- flow_templates
create table if not exists public.flow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  icon text,
  color text,
  questions_json jsonb not null,
  ai_analysis_guidance text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.flow_templates to authenticated;
grant all on public.flow_templates to service_role;
alter table public.flow_templates enable row level security;
create policy "flow_templates_select_active" on public.flow_templates for select to authenticated using (is_active = true);
create trigger set_flow_templates_updated_at before update on public.flow_templates for each row execute function public.set_updated_at();

-- flow_sessions
create table if not exists public.flow_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flow_template_id uuid not null references public.flow_templates(id),
  title text,
  responses_json jsonb not null default '{}'::jsonb,
  ai_analysis_json jsonb,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.flow_sessions to authenticated;
grant all on public.flow_sessions to service_role;
create index if not exists flow_sessions_user_id_idx on public.flow_sessions (user_id);
create index if not exists flow_sessions_status_idx on public.flow_sessions (status);
create index if not exists flow_sessions_created_at_idx on public.flow_sessions (created_at desc);
alter table public.flow_sessions enable row level security;
create policy "flow_sessions_select_own" on public.flow_sessions for select to authenticated using (user_id = auth.uid());
create policy "flow_sessions_insert_own" on public.flow_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "flow_sessions_update_own" on public.flow_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "flow_sessions_delete_own" on public.flow_sessions for delete to authenticated using (user_id = auth.uid());
create trigger set_flow_sessions_updated_at before update on public.flow_sessions for each row execute function public.set_updated_at();

-- Seed flow templates
insert into public.flow_templates (name, slug, description, icon, color, display_order, ai_analysis_guidance, questions_json)
values
(
  'Prayer Flow', 'prayer',
  'A guided prayer time — adoration, confession, thanks, and listening.',
  '🙏', '#3b4a6b', 1,
  'This was a prayer time. Affirm their honesty before God. Reflect back what their prayer reveals about where their heart is. Gently surface anything they prayed around but not through. Tie the scripture_connection to what they brought to God.',
  $q$[
    {"id":"title","type":"text","required":true,"prompt":"Give this prayer time a name."},
    {"id":"heart","type":"textarea","required":true,"prompt":"What's on your heart as you come to pray right now?"},
    {"id":"adoration","type":"textarea","required":true,"prompt":"Who is God to you in this moment? Praise Him for who He is."},
    {"id":"confession","type":"textarea","required":false,"prompt":"Is there anything you need to confess or lay down? Be honest — this is between you and Him."},
    {"id":"thanksgiving","type":"textarea","required":true,"prompt":"What are you thankful for today? Name it specifically."},
    {"id":"petition","type":"textarea","required":true,"prompt":"What do you need to ask God for, for yourself?"},
    {"id":"intercession","type":"textarea","required":false,"prompt":"Who else are you lifting up, and what are you asking on their behalf?"},
    {"id":"surrender","type":"textarea","required":false,"prompt":"What are you gripping tightly that you need to surrender to Him?"},
    {"id":"listening","type":"textarea","required":true,"prompt":"Sit quietly for a moment. What do you sense He might be saying to you?"},
    {"id":"verse","type":"text","required":false,"prompt":"Is there a verse or promise He's bringing to mind? (optional)"},
    {"id":"action","type":"textarea","required":true,"prompt":"What's one step of obedience or faith you'll take in the next 24 hours?"}
  ]$q$::jsonb
),
(
  'Bible Flow', 'bible',
  'Study a passage — observe, interpret, and apply it to today.',
  '📖', '#c89b3c', 2,
  'This was a Scripture study. Honor what they observed. Deepen their interpretation where it''s thin, affirm where it''s strong. Make sure the application (start/stop/sustain and the action) is concrete and livable. The scripture_connection can be the passage itself or a complementary verse.',
  $q$[
    {"id":"passage","type":"textarea","required":true,"interpolation_key":"passage","prompt":"What passage are you reading today? Enter the reference (book, chapter, verses) — or paste the text itself."},
    {"id":"first_read","type":"textarea","required":true,"prompt":"Read it slowly. What's your first honest reaction?"},
    {"id":"stood_out","type":"textarea","required":true,"prompt":"What word, phrase, or verse stood out most? Why that one?"},
    {"id":"about_god","type":"textarea","required":true,"prompt":"What does this passage show you about God — His character, His heart?"},
    {"id":"about_self","type":"textarea","required":true,"prompt":"What does it reveal about you, or about people in general?"},
    {"id":"context","type":"textarea","required":false,"prompt":"What do you think was happening here, and who was it first written for?"},
    {"id":"wrestle","type":"textarea","required":false,"prompt":"Is there anything here that's hard, confusing, or that you want to push back on?"},
    {"id":"start","type":"text","required":true,"prompt":"Based on this, what's one thing you sense God inviting you to START?"},
    {"id":"stop","type":"text","required":true,"prompt":"What's one thing to STOP?"},
    {"id":"sustain","type":"text","required":true,"prompt":"What's one thing to KEEP doing?"},
    {"id":"prayer_response","type":"textarea","required":true,"prompt":"Turn what you've seen into a short prayer back to God."},
    {"id":"action","type":"textarea","required":true,"prompt":"What's the one concrete way you'll live this out today?"}
  ]$q$::jsonb
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  color = excluded.color, display_order = excluded.display_order,
  ai_analysis_guidance = excluded.ai_analysis_guidance,
  questions_json = excluded.questions_json, is_active = true, updated_at = now();
