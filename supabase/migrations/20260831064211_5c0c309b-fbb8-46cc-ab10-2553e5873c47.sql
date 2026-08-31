-- TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  leader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- ROLE MIGRATION: admins become team leaders, oldest account becomes CEO
UPDATE public.user_roles SET role = 'team_leader' WHERE role = 'admin';
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'ceo'::public.app_role FROM public.profiles ORDER BY created_at LIMIT 1
ON CONFLICT DO NOTHING;

-- HELPERS
CREATE OR REPLACE FUNCTION public.my_team_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'ceo' THEN 0 WHEN 'team_leader' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_is_first boolean;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do nothing;

  select not exists (select 1 from public.user_roles) into v_is_first;

  insert into public.user_roles (user_id, role)
  values (new.id, case when v_is_first then 'ceo'::public.app_role else 'agent'::public.app_role end)
  on conflict do nothing;

  return new;
end $$;

-- TEAMS POLICIES
CREATE POLICY "CEO manages teams" ON public.teams FOR ALL TO authenticated
USING (has_role(auth.uid(), 'ceo')) WITH CHECK (has_role(auth.uid(), 'ceo'));
CREATE POLICY "Signed-in users read teams" ON public.teams FOR SELECT TO authenticated USING (true);

-- LEADS POLICIES
DROP POLICY IF EXISTS "Admins full access to leads" ON public.leads;
DROP POLICY IF EXISTS "Agents claim unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents view unassigned leads" ON public.leads;

CREATE POLICY "Team leaders manage own team leads" ON public.leads FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_leader') AND team_id IS NOT DISTINCT FROM public.my_team_id())
WITH CHECK (has_role(auth.uid(), 'team_leader') AND team_id IS NOT DISTINCT FROM public.my_team_id());

CREATE POLICY "Agents view own team leads" ON public.leads FOR SELECT TO authenticated
USING (assigned_to = auth.uid()
  OR (assigned_to IS NULL AND has_role(auth.uid(), 'agent') AND team_id IS NOT DISTINCT FROM public.my_team_id()));

CREATE POLICY "Agents update assigned leads" ON public.leads FOR UPDATE TO authenticated
USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Agents claim unassigned team leads" ON public.leads FOR UPDATE TO authenticated
USING (assigned_to IS NULL AND has_role(auth.uid(), 'agent') AND team_id IS NOT DISTINCT FROM public.my_team_id())
WITH CHECK (assigned_to = auth.uid());

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "CEO manages all profiles" ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ceo'));
CREATE POLICY "CEO updates any profile" ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'ceo')) WITH CHECK (has_role(auth.uid(), 'ceo'));
CREATE POLICY "Team leaders view own team profiles" ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'team_leader') AND team_id IS NOT DISTINCT FROM public.my_team_id());

-- USER ROLES POLICIES
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins see all roles" ON public.user_roles;
CREATE POLICY "CEO manages roles" ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'ceo')) WITH CHECK (has_role(auth.uid(), 'ceo'));
CREATE POLICY "Team leaders read own team roles" ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'team_leader')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.team_id IS NOT DISTINCT FROM public.my_team_id()));