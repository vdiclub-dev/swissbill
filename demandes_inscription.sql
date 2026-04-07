-- Demandes d'accès (sans mot de passe) — l'admin crée le compte et attribue le rôle + code dans Colixo.
-- Exécuter dans Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS public.demandes_inscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  prenom text NOT NULL,
  nom text NOT NULL,
  email text NOT NULL,
  telephone text,
  entreprise_nom text,
  adresse text,
  message text,
  statut text NOT NULL DEFAULT 'en_attente'
);

COMMENT ON TABLE public.demandes_inscription IS 'Demandes d''inscription depuis login (onglet) — traitement manuel par admin';

ALTER TABLE public.demandes_inscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demandes_inscription_insert_public" ON public.demandes_inscription;
CREATE POLICY "demandes_inscription_insert_public"
  ON public.demandes_inscription FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "demandes_inscription_select_admin" ON public.demandes_inscription;
CREATE POLICY "demandes_inscription_select_admin"
  ON public.demandes_inscription FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utilisateurs u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
    )
  );
