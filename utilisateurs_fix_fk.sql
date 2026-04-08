-- ÉTAPE 1 : Vérifier la contrainte (pour confirmer qu'elle existe)
SELECT conname, contype, confupdtype, confdeltype
FROM pg_constraint
WHERE conrelid = 'utilisateurs'::regclass AND conname = 'utilisateurs_id_fkey';

-- ÉTAPE 2 : Supprimer la contrainte FK (id ne pointe plus vers auth.users)
ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_id_fkey;

-- ÉTAPE 3 : Donner un défaut auto-UUID si pas déjà fait
ALTER TABLE utilisateurs ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ÉTAPE 4 : RLS permissif
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acces_total_utilisateurs" ON utilisateurs;
CREATE POLICY "acces_total_utilisateurs"
  ON utilisateurs FOR ALL USING (true) WITH CHECK (true);
