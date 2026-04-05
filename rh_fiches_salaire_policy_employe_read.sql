-- Lecture des fiches par l’employé concerné (app chauffeur / consultation)
-- À exécuter dans Supabase SQL Editor après rh_fiches_salaire

DROP POLICY IF EXISTS "rh_fiches_salaire_read_own" ON rh_fiches_salaire;
CREATE POLICY "rh_fiches_salaire_read_own" ON rh_fiches_salaire
    FOR SELECT TO authenticated
    USING (employe_id = auth.uid());
