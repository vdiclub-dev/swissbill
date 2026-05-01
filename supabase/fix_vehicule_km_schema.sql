-- ============================================================
-- FIX : table vehicule_km — colonnes carburant + RLS anon
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajouter les colonnes carburant si elles n'existent pas
ALTER TABLE public.vehicule_km
    ADD COLUMN IF NOT EXISTS carburant_litres            NUMERIC(8,3),
    ADD COLUMN IF NOT EXISTS carburant_prix_litre_chf    NUMERIC(8,4),
    ADD COLUMN IF NOT EXISTS carburant_montant_chf       NUMERIC(10,2);

-- km_parcourus : si colonne normale, la rendre générée automatiquement
-- (si déjà GENERATED, cette commande peut échouer → ignorer l'erreur)
DO $$
BEGIN
    -- Vérifier si km_parcourus est déjà une colonne générée
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'vehicule_km'
          AND column_name  = 'km_parcourus'
          AND is_generated = 'ALWAYS'
    ) THEN
        -- Supprimer la colonne normale et la recréer comme générée
        ALTER TABLE public.vehicule_km DROP COLUMN IF EXISTS km_parcourus;
        ALTER TABLE public.vehicule_km
            ADD COLUMN km_parcourus NUMERIC(10,2)
            GENERATED ALWAYS AS (GREATEST(km_fin - km_debut, 0)) STORED;
    END IF;
END $$;

-- 2. Contrainte unique pour l'upsert (vehicule_id, date)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'vehicule_km_vehicule_id_date_key'
    ) THEN
        ALTER TABLE public.vehicule_km
            ADD CONSTRAINT vehicule_km_vehicule_id_date_key UNIQUE (vehicule_id, date);
    END IF;
END $$;

-- 3. RLS anon (lecture + écriture)
ALTER TABLE public.vehicule_km ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_vehicule_km"    ON public.vehicule_km;
DROP POLICY IF EXISTS "service_all_vehicule_km" ON public.vehicule_km;

CREATE POLICY "anon_all_vehicule_km"
ON public.vehicule_km FOR ALL TO anon
USING (true) WITH CHECK (true);

CREATE POLICY "service_all_vehicule_km"
ON public.vehicule_km FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 4. Vérification
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vehicule_km';
