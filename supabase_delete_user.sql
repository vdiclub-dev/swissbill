-- ================================================================
--  FONCTION : admin_delete_user
--  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor
--  Permet de supprimer un compte auth.users depuis le front-end
--  sans avoir besoin de la clé service_role
-- ================================================================

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- s'exécute avec les droits du propriétaire (postgres)
SET search_path = public
AS $$
DECLARE
    calling_user_role text;
BEGIN
    -- Vérifier que l'appelant est admin ou super_admin
    SELECT role INTO calling_user_role
    FROM public.utilisateurs
    WHERE id = auth.uid();

    IF calling_user_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Permission refusée — seuls les admins peuvent supprimer des comptes';
    END IF;

    -- Empêcher l'auto-suppression
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
    END IF;

    -- Supprimer le compte dans auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Donner l'accès aux utilisateurs authentifiés (la vérification admin est dans la fonction)
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
