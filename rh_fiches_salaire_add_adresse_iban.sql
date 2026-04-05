-- Adresses, date du bulletin, IBAN — bases déjà créées (Supabase SQL Editor)
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS employeur_adresse text;
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS employe_adresse text;
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS date_bulletin date;
ALTER TABLE rh_fiches_salaire ADD COLUMN IF NOT EXISTS iban_versement text;

ALTER TABLE rh_employe_parametres_salaire ADD COLUMN IF NOT EXISTS employeur_adresse text;
ALTER TABLE rh_employe_parametres_salaire ADD COLUMN IF NOT EXISTS employe_adresse text;
ALTER TABLE rh_employe_parametres_salaire ADD COLUMN IF NOT EXISTS iban text;
