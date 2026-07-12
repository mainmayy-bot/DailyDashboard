create table if not exists public.user_boards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_boards enable row level security;

drop policy if exists "Users can read their own board" on public.user_boards;
create policy "Users can read their own board"
on public.user_boards for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own board" on public.user_boards;
create policy "Users can insert their own board"
on public.user_boards for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own board" on public.user_boards;
create policy "Users can update their own board"
on public.user_boards for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
