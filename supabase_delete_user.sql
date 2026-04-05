-- ================================================================
--  FONCTIONS SUPABASE — À exécuter dans SQL Editor
--  https://supabase.com/dashboard/project/iubbsnntcreneakbdkmv/sql/new
--  Exécuter UNE SEULE FOIS
-- ================================================================


-- ── 1. Récupérer l'ID d'un utilisateur par email (comptes orphelins)
CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_role text;
    found_id uuid;
BEGIN
    -- Réservé aux admins
    SELECT role INTO calling_role FROM public.utilisateurs WHERE id = auth.uid();
    IF calling_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Permission refusée';
    END IF;

    SELECT id INTO found_id FROM auth.users WHERE email = user_email LIMIT 1;
    RETURN found_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO authenticated;


-- ── 2. Supprimer un compte auth.users définitivement
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    calling_role text;
BEGIN
    SELECT role INTO calling_role FROM public.utilisateurs WHERE id = auth.uid();
    IF calling_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Permission refusée';
    END IF;

    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
    END IF;

    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
