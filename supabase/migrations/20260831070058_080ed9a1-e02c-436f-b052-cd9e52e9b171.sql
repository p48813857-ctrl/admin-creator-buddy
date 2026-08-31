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
revoke execute on function public.current_user_role() from authenticated;

create policy "Agents view unassigned leads" on public.leads
  for select to authenticated
  using (assigned_to is null and public.has_role(auth.uid(), 'agent'));

create policy "Agents claim unassigned leads" on public.leads
  for update to authenticated
  using (assigned_to is null and public.has_role(auth.uid(), 'agent'))
  with check (assigned_to = auth.uid());