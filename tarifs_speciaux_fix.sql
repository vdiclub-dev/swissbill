-- Correction contrainte CHECK sur tarifs_speciaux.type
-- Ajoute les valeurs manquantes : volume, custom
-- À exécuter dans Supabase → SQL Editor

ALTER TABLE tarifs_speciaux
  DROP CONSTRAINT IF EXISTS tarifs_speciaux_type_check;

ALTER TABLE tarifs_speciaux
  ADD CONSTRAINT tarifs_speciaux_type_check
  CHECK (type IN ('forfait','vignologue','zone','volume','custom','negocie','standard'));
