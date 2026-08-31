grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.my_team_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;