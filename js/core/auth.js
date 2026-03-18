// ==========================================
// Fichier : /js/core/auth.js
// Gestion des sessions et de l’authentification
// ==========================================

import { supabase } from "./supabase-client.js";

// --- Vérifie la session en cours / protection des pages ---
export async function checkSession(role = null) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) {
    console.warn("⚠️ Aucun utilisateur connecté");
    window.location.href = "/login/index.html";
    return;
  }

  // Si un rôle est exigé, on le compare à celui du compte
  if (role) {
    const { user } = session;
    const userRole = user?.app_metadata?.role || "aucun";
    if (userRole !== role) {
      alert(`Accès refusé : rôle attendu (${role}), trouvé (${userRole})`);
      await logout();
      return;
    }
  }

  console.log("✅ Session active :", session.user.email);
}

// --- Connexion ---
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Erreur de connexion : " + error.message);
    throw error;
  }

  window.location.href = "/client/dashboard.html"; // page par défaut après login
}

// --- Déconnexion ---
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/login/index.html";
}

