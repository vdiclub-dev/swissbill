# ==================================================
# COLIXO - GUIDE D'INSTALLATION ET DOCUMENTATION
# ==================================================

## 1. RÉSUMÉ DE L'ARCHITECTURE

### Structure des fichiers
```
/workspace
├── supabase/
│   └── sql/
│       └── 001_import_tables.sql    # Script SQL complet (tables, RLS, triggers)
├── client/
│   ├── import.html                   # Page d'importation principale
│   ├── css/
│   │   └── import.css                # Styles de la page d'import
│   └── js/
│       ├── supabase-config.js        # Configuration Supabase
│       ├── import-mapping.js         # Détection et mapping des colonnes
│       ├── pricing-engine.js         # Calcul des prix
│       ├── csv-error-report.js       # Génération rapport d'erreurs
│       └── import.js                 # Logique principale d'import
├── examples/
│   ├── import_example.csv            # Exemple de fichier CSV
│   └── tariff_rules_example.sql      # Exemple de grille tarifaire
└── INSTALLATION.md                   # Ce fichier
```

### Flux d'importation
1. **Upload** → Client dépose fichier CSV/Excel
2. **Parsing** → Lecture avec PapaParse (CSV) ou XLSX.js (Excel)
3. **Mapping** → Détection automatique via synonymes
4. **Validation** → Vérification champs obligatoires + doublons
5. **Pricing** → Calcul selon grille tarifaire client
6. **Import** → Création des commandes dans Supabase

---

## 2. INSTALLATION SUPABASE

### Étape 1: Créer les tables
1. Ouvrir le Dashboard Supabase
2. Aller dans "SQL Editor"
3. Copier-coller le contenu de `/supabase/sql/001_import_tables.sql`
4. Exécuter le script

### Étape 2: Configurer les identifiants
Dans `/client/js/supabase-config.js`, remplacer:
```javascript
const SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_ANON_KEY'
};
```

Par vos valeurs:
- `YOUR_PROJECT_ID`: Trouvable dans Settings > API
- `YOUR_ANON_KEY`: Clé "anon public" dans Settings > API

### Étape 3: Vérifier la table clients
Le code suppose l'existence d'une table `clients` avec:
- `id` (UUID)
- `user_id` (UUID) → lien vers auth.users
- `company_name` (TEXT)
- `default_pickup_address` (JSONB ou TEXT)

Si elle n'existe pas, créer:
```sql
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    company_name TEXT,
    default_pickup_address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client profile"
ON clients FOR SELECT
USING (user_id = auth.uid());
```

---

## 3. INTÉGRATION DANS LE PORTAIL EXISTANT

### Ajouter un lien dans la navigation
Dans votre fichier de navigation existant (ex: `/client/portal.html`):
```html
<a href="/client/import.html" class="nav-link">Importer des livraisons</a>
```

### Fichiers à inclure
La page `/client/import.html` inclut automatiquement:
- `/client/css/import.css` (styles)
- Librairies CDN (Supabase, XLSX, PapaParse)
- Tous les fichiers JavaScript nécessaires

### Adapter le header/footer
Modifier `/client/import.html` pour correspondre au design de votre portail:
- Remplacer la section `<nav class="navbar">` par votre navigation existante
- Ajuster les chemins CSS si nécessaire

---

## 4. EXEMPLE DE FICHIER CSV ACCEPTÉ

Voir `/examples/import_example.csv`

Format minimal requis:
```csv
Référence;Nom destinataire;Adresse livraison;NPA;Ville;Nombre de colis
CMD-001;Dupont Jean;Rue du Commerce 15;1201;Genève;2
CMD-002;Martin Sophie;Avenue de la Gare 42;1003;Lausanne;1
```

Synonymes reconnus automatiquement:
- Référence → ref, commande, order id, etc.
- Nom destinataire → customer, recipient, destinataire, etc.
- NPA → code postal, zip, postal code, etc.

---

## 5. EXEMPLE DE GRILLE TARIFAIRE

Voir `/examples/tariff_rules_example.sql`

Exemple rapide pour un client:
```sql
INSERT INTO client_tariff_rules (
    client_id, name, service_level, 
    min_weight_kg, max_weight_kg, 
    base_price_chf, price_per_parcel_chf,
    fuel_surcharge_percent, priority
) VALUES (
    'UUID_DU_CLIENT',
    'Eco Standard',
    'eco_48h',
    0, 30,
    10.00,
    1.00,
    2.0,
    100
);
```

---

## 6. CHECKLIST DE TEST COMPLÈTE

### Tests fonctionnels
- [ ] Upload fichier CSV (< 10 MB)
- [ ] Upload fichier Excel (.xlsx)
- [ ] Upload fichier Excel (.xls)
- [ ] Refus fichier non supporté (.pdf, .doc)
- [ ] Refus fichier trop volumineux (> 10 MB)
- [ ] Détection automatique des colonnes
- [ ] Correction manuelle du mapping
- [ ] Sauvegarde profil d'import
- [ ] Chargement profil existant
- [ ] Validation champs obligatoires
- [ ] Détection doublons dans le fichier
- [ ] Détection doublons en base de données
- [ ] Calcul des prix correct
- [ ] Application supplément carburant
- [ ] Application rabais
- [ ] Import des lignes valides
- [ ] Rejet des lignes erronées
- [ ] Téléchargement rapport d'erreurs
- [ ] Anti-doublon fonctionne (client_id + reference)

### Tests de sécurité
- [ ] Utilisateur non connecté → redirection login
- [ ] Client A ne voit pas les imports de Client B
- [ ] Client A ne voit pas les orders de Client B
- [ ] RLS activé sur toutes les tables
- [ ] Pas de clé service_role dans le frontend
- [ ] Injection SQL impossible (requêtes paramétrées)

### Tests d'erreur
- [ ] Fichier vide → message d'erreur clair
- [ ] Fichier sans header → gestion propre
- [ ] Colonnes inconnues → ignorées
- [ ] Champs obligatoires manquants → blocage
- [ ] Erreur Supabase → message utilisateur
- [ ] Pas de grille tarifaire → "Prix à valider"

### Tests de performance
- [ ] Import 100 lignes < 5 secondes
- [ ] Import 500 lignes < 15 secondes
- [ ] Import 1000 lignes < 30 secondes
- [ ] Pagination affichage (> 100 lignes)

---

## 7. POINTS DE SÉCURITÉ À VÉRIFIER

### Avant mise en production

1. **Clés Supabase**
   - [ ] Utiliser uniquement la clé ANON dans le frontend
   - [ ] Jamais de clé service_role côté client
   - [ ] Variables d'environnement pour les clés sensibles

2. **Row Level Security (RLS)**
   - [ ] RLS activé sur `client_import_profiles`
   - [ ] RLS activé sur `import_batches`
   - [ ] RLS activé sur `orders`
   - [ ] RLS activé sur `client_tariff_rules`
   - [ ] Policies testées avec différents utilisateurs

3. **Validation des données**
   - [ ] Échappement HTML (XSS)
   - [ ] Validation types de données
   - [ ] Limitation taille fichiers
   - [ ] Sanitization des entrées

4. **Contrôle d'accès**
   - [ ] Authentification requise
   - [ ] Vérification client_id à chaque opération
   - [ ] Logs des imports pour audit

---

## 8. ERREURS POSSIBLES ET CORRECTIONS

### Erreur: "Profil client introuvable"
**Cause:** Table `clients` vide ou mal configurée
**Solution:** Vérifier que l'utilisateur connecté a un enregistrement dans `clients`

### Erreur: "relation does not exist"
**Cause:** Tables non créées dans Supabase
**Solution:** Exécuter le script SQL `/supabase/sql/001_import_tables.sql`

### Erreur: "permission denied for table"
**Cause:** RLS trop restrictif ou policies manquantes
**Solution:** Vérifier les policies dans Supabase > Authentication > Policies

### Erreur: "duplicate key value violates unique constraint"
**Cause:** Doublon external_reference pour le même client
**Solution:** Comportement normal - la ligne est rejetée avec message

### Erreur: "File too large"
**Cause:** Fichier > 10 MB
**Solution:** Diviser le fichier ou augmenter la limite (déconseillé)

### Mapping incorrect
**Cause:** Synonymes non reconnus
**Solution:** Ajouter les synonymes dans `FIELD_SYNONYMS` (import-mapping.js)

### Prix toujours null
**Cause:** Aucune règle tarifaire trouvée
**Solution:** Créer des règles dans `client_tariff_rules` pour ce client

---

## 9. PERSONNALISATION

### Ajouter de nouveaux synonymes
Dans `/client/js/import-mapping.js`:
```javascript
const FIELD_SYNONYMS = {
    delivery_name: [
        // ... synonymes existants
        'nouveau synonyme'
    ],
    // ...
};
```

### Modifier les champs obligatoires
Dans `/client/js/import-mapping.js`:
```javascript
const REQUIRED_FIELDS = [
    'external_reference',
    'delivery_name',
    // Ajouter ou retirer des champs
];
```

### Adapter la formule de calcul
Dans `/client/js/pricing-engine.js`:
```javascript
function calculateOrderPrice(order, rule) {
    // Personnaliser la logique de calcul
}
```

---

## 10. SUPPORT ET MAINTENANCE

### Logs à surveiller
- Console navigateur (erreurs JS)
- Supabase Logs (erreurs DB)
- Table `import_batches` (statuts d'import)

### Métriques utiles
```sql
-- Nombre d'imports par jour
SELECT DATE(created_at) as date, COUNT(*) as imports
FROM import_batches
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Taux d'erreur moyen
SELECT 
    AVG(error_rows::float / NULLIF(total_rows, 0)) * 100 as error_rate
FROM import_batches;
```

---

## 11. CONTACT ET RESSOURCES

- Documentation Supabase: https://supabase.com/docs
- PapaParse Docs: https://www.papaparse.com/docs
- XLSX.js Docs: https://github.com/SheetJS/sheetjs
- Support Colixo: support@colixo.ch
