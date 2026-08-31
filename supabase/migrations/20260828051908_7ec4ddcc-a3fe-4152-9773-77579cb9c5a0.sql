revoke execute on function public.current_user_role() from authenticated;

create policy "Agents view unassigned leads" on public.leads
  for select to authenticated
  using (assigned_to is null and public.has_role(auth.uid(), 'agent'));

create policy "Agents claim unassigned leads" on public.leads
  for update to authenticated
  using (assigned_to is null and public.has_role(auth.uid(), 'agent'))
  with check (assigned_to = auth.uid());