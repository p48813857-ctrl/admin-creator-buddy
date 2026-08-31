GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_team_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;