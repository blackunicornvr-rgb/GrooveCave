create extension if not exists "pgcrypto";

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role text not null check (role in ('artista', 'oyente', 'promotor')),
  message text,
  status text not null default 'pendiente' check (status in ('pendiente', 'contactado', 'rechazado')),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "Allow anonymous inserts"
on public.waitlist
for insert
with check (true);

create policy "Allow admin reads only"
on public.waitlist
for select
using (false);
