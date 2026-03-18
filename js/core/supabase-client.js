// ==========================================
// Fichier : /js/core/supabase-client.js
// Connexion unique à Supabase
// ==========================================

import { createClient } from "[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm)";

// ⚠️ Remplace les deux lignes ci-dessous
const SUPABASE_URL = "[xxxxx.supabase.co](https://iubbsnntcreneakbdkmv.supabase.co)";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y";

// Création du client Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Vérification de la connexion
console.log("✅ Supabase initialisé :", SUPABASE_URL);

