-- ============================================================
-- MIGRATION : mail_prospects → prospects (CRM complet)
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Voir ce qu'il y a dans mail_prospects avant migration
SELECT id, full_name, company, email, phone, status, quality_score,
       source, notes, last_contact_at, created_at
FROM public.mail_prospects
WHERE brand = 'colixo'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Migration (décommentez après avoir vérifié les données ci-dessus)
/*
INSERT INTO public.prospects (
    entreprise,
    contact_nom,
    email,
    telephone,
    statut,
    score,
    score_classe,
    notes,
    created_at
)
SELECT
    COALESCE(NULLIF(company, ''), full_name, 'Inconnu')  AS entreprise,
    full_name                                             AS contact_nom,
    email,
    phone                                                 AS telephone,
    -- Conversion des statuts mail_prospects → prospects
    CASE status
        WHEN 'new'         THEN 'nouveau'
        WHEN 'sent_j0'     THEN 'contacte'
        WHEN 'sent_j3'     THEN 'relance_1_envoyee'
        WHEN 'sent_j7'     THEN 'relance_2_envoyee'
        WHEN 'replied'     THEN 'repondu'
        WHEN 'won'         THEN 'client_gagne'
        WHEN 'lost'        THEN 'perdu'
        WHEN 'unsubscribe' THEN 'sans_suite'
        ELSE 'nouveau'
    END                                                   AS statut,
    COALESCE(quality_score, 50)                           AS score,
    CASE
        WHEN COALESCE(quality_score, 50) >= 70 THEN 'A'
        WHEN COALESCE(quality_score, 50) >= 45 THEN 'B'
        ELSE 'C'
    END                                                   AS score_classe,
    notes,
    COALESCE(created_at, now())                           AS created_at
FROM public.mail_prospects
WHERE brand = 'colixo'
  AND email IS NOT NULL
  AND email != ''
ON CONFLICT DO NOTHING;
*/

-- 3. Vérification après migration
-- SELECT count(*) FROM public.prospects;
