-- Migration : ajout du N° USR pour les membres de l'équipe Colixo
-- À exécuter une seule fois dans l'éditeur SQL Supabase.

ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS code_usr TEXT UNIQUE;

-- Index pour les recherches par code (login)
CREATE INDEX IF NOT EXISTS idx_utilisateurs_code_usr ON utilisateurs (code_usr);

-- Optionnel : voir les utilisateurs existants sans code
-- SELECT id, email, role FROM utilisateurs WHERE code_usr IS NULL ORDER BY role;
