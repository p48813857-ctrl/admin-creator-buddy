
-- Roles enum
create type public.app_role as enum ('admin', 'agent');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- get_my_role helper (returns highest role)
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = auth.uid()
  order by case when role = 'admin' then 0 else 1 end
  limit 1
$$;

-- Profiles RLS
create policy "Users view own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Admins view all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());
create policy "Admins update any profile" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- User roles RLS
create policy "Users see own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "Admins see all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,
  notes text,
  status text not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;

create index on public.leads(assigned_to);
create index on public.leads(status);

-- Leads RLS
create policy "Admins full access to leads" on public.leads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Agents view assigned leads" on public.leads
  for select to authenticated using (assigned_to = auth.uid());
create policy "Agents update assigned leads" on public.leads
  for update to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- New user trigger: create profile + assign role (first user = admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first boolean;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email
  )
  on conflict (id) do nothing;

  select not exists (select 1 from public.user_roles) into v_is_first;

  insert into public.user_roles (user_id, role)
  values (new.id, case when v_is_first then 'admin'::public.app_role else 'agent'::public.app_role end)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create index on public.messages(created_at desc);
create index on public.messages(recipient_id);
create index on public.messages(sender_id);

create policy "Anyone signed-in reads team room" on public.messages
  for select to authenticated using (recipient_id is null);

create policy "Users read their DMs" on public.messages
  for select to authenticated
  using (recipient_id is not null and (sender_id = auth.uid() or recipient_id = auth.uid()));

create policy "Users send as themselves" on public.messages
  for insert to authenticated with check (sender_id = auth.uid());

create policy "Users delete own messages" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

alter publication supabase_realtime add table public.messages;
alter table public.messages replica identity full;
