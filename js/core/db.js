// ==========================================
// Fichier : /js/core/db.js
// Fonctions centralisées pour interagir avec la base Supabase
// ==========================================

import { supabase } from "./supabase-client.js";

export const DB = {
  // --- Commandes client ---
  async getCommandes() {
    const { data, error } = await supabase.from("commandes").select("*");
    if (error) console.error("Erreur getCommandes:", error);
    return data || [];
  },

  async addCommande(commande) {
    const { data, error } = await supabase.from("commandes").insert([commande]);
    if (error) console.error("Erreur addCommande:", error);
    return data;
  },

  // --- Chauffeurs ---
  async getChauffeurs() {
    const { data, error } = await supabase.from("chauffeurs").select("*");
    if (error) console.error("Erreur getChauffeurs:", error);
    return data || [];
  },

  // --- Transports ---
  async getTransports() {
    const { data, error } = await supabase.from("transports").select("*");
    if (error) console.error("Erreur getTransports:", error);
    return data || [];
  }
};

console.log("✅ Module DB chargé");

