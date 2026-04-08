-- ============================================================
--  Fonction RPC : enregistrer la tournée + l’affectation en UNE transaction.
--  Évite l’erreur FK tournee_affectations_tournee_id_fkey quand RLS ou deux
--  requêtes HTTP séparées empêchent de voir la ligne parent.
--  Supabase → SQL Editor → Run, puis tester l’affectation dans l’app.
-- ============================================================

CREATE OR REPLACE FUNCTION public.colixo_save_tournee_affectation(
  p_tournee jsonb,
  p_date date,
  p_employe_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid := (p_tournee->>'id')::uuid;
  jours_val int[];
BEGIN
  IF tid IS NULL THEN
    RAISE EXCEPTION 'colixo: id tournée manquant';
  END IF;

  SELECT COALESCE(
    ARRAY(
      SELECT (elem::text)::int
      FROM jsonb_array_elements(COALESCE(p_tournee->'jours', '[1,2,3,4,5]'::jsonb)) AS elem
    ),
    ARRAY[1,2,3,4,5]::int[]
  ) INTO jours_val;

  INSERT INTO public.tournees (id, numero_tournee, nom, heure_debut, heure_fin, zone, vehicle, jours, couleur, notes)
  VALUES (
    tid,
    COALESCE(NULLIF(TRIM(p_tournee->>'numero_tournee'), '')::integer, 1),
    COALESCE(NULLIF(TRIM(p_tournee->>'nom'), ''), 'Tournée'),
    COALESCE((p_tournee->>'heure_debut')::time, TIME '07:00'),
    COALESCE((p_tournee->>'heure_fin')::time, TIME '18:00'),
    NULLIF(TRIM(p_tournee->>'zone'), ''),
    NULLIF(TRIM(p_tournee->>'vehicle'), ''),
    jours_val,
    COALESCE(NULLIF(TRIM(p_tournee->>'couleur'), ''), '#4f8ef7'),
    NULLIF(TRIM(p_tournee->>'notes'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    numero_tournee = EXCLUDED.numero_tournee,
    nom = EXCLUDED.nom,
    heure_debut = EXCLUDED.heure_debut,
    heure_fin = EXCLUDED.heure_fin,
    zone = EXCLUDED.zone,
    vehicle = EXCLUDED.vehicle,
    jours = EXCLUDED.jours,
    couleur = EXCLUDED.couleur,
    notes = EXCLUDED.notes;

  INSERT INTO public.tournee_affectations (tournee_id, date, employe_id)
  VALUES (tid, p_date, p_employe_id)
  ON CONFLICT (tournee_id, date) DO UPDATE SET employe_id = EXCLUDED.employe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.colixo_save_tournee_affectation(jsonb, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.colixo_save_tournee_affectation(jsonb, date, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.colixo_save_tournee_affectation(jsonb, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.colixo_save_tournee_affectation(jsonb, date, uuid) TO service_role;
