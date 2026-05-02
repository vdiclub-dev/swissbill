-- ============================================================
-- Table : formulaires_embauche
-- Stocke les candidatures soumises via le formulaire d'embauche
-- ============================================================

CREATE TABLE IF NOT EXISTS public.formulaires_embauche (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    nom         TEXT,
    prenom      TEXT,
    email       TEXT,
    poste_vise  TEXT,
    statut      TEXT NOT NULL DEFAULT 'nouveau'
                    CHECK (statut IN ('nouveau','en_cours','embauche','refuse','archive')),
    note_interne TEXT,
    data        JSONB NOT NULL DEFAULT '{}'
);

-- Index pour les recherches courantes
CREATE INDEX IF NOT EXISTS idx_fe_statut      ON public.formulaires_embauche (statut);
CREATE INDEX IF NOT EXISTS idx_fe_created_at  ON public.formulaires_embauche (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fe_nom         ON public.formulaires_embauche (nom, prenom);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_fe_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_fe_updated_at ON public.formulaires_embauche;
CREATE TRIGGER trg_fe_updated_at
    BEFORE UPDATE ON public.formulaires_embauche
    FOR EACH ROW EXECUTE FUNCTION update_fe_updated_at();

-- RLS
ALTER TABLE public.formulaires_embauche ENABLE ROW LEVEL SECURITY;

-- Service role (super admin) : accès complet
DROP POLICY IF EXISTS "service_fe_all" ON public.formulaires_embauche;
CREATE POLICY "service_fe_all"
ON public.formulaires_embauche FOR ALL TO service_role USING (true) WITH CHECK (true);

-- anon peut INSERT (soumission formulaire) mais pas lire
DROP POLICY IF EXISTS "anon_fe_insert" ON public.formulaires_embauche;
CREATE POLICY "anon_fe_insert"
ON public.formulaires_embauche FOR INSERT TO anon WITH CHECK (true);

-- authenticated (admin) : accès complet
DROP POLICY IF EXISTS "auth_fe_all" ON public.formulaires_embauche;
CREATE POLICY "auth_fe_all"
ON public.formulaires_embauche FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vérification
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'formulaires_embauche'
ORDER BY cmd;
