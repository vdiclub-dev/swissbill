/**
 * Crée un compte Supabase Auth + ligne public.utilisateurs (FK utilisateurs.id → auth.users).
 *
 * Authentification admin (au choix) :
 * - JWT Supabase (session « Email + mot de passe »), ou
 * - Corps JSON : admin_id + admin_code (même principe que la connexion par code admin).
 *
 * Déploiement :
 *   supabase functions deploy create-inscription-user --no-verify-jwt
 *
 * Secrets : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (hébergeur).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_ROLES = ["client", "chauffeur", "magasinier", "admin"];

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function randomPassword(): string {
  const buf = new Uint8Array(28);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf, (b) => ("0" + b.toString(16)).slice(-2)).join("");
  return "Colixo-" + hex;
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  emailNorm: string,
): Promise<string | null> {
  const target = emailNorm.toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users;
    const found = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found) return found.id;
    if (users.length < perPage) break;
    page++;
  }
  return null;
}

type Body = {
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string | null;
  entreprise_nom?: string | null;
  role?: string;
  code_usr?: string;
  /** Connexion admin par code (sans JWT) */
  admin_id?: string;
  admin_code?: string;
};

function normCode(s: string): string {
  return String(s ?? "").trim().toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Méthode non autorisée (POST uniquement)." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: "Configuration serveur Supabase incomplète." });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Corps JSON invalide." });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  let isAdmin = false;

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (!userErr && userData.user) {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("utilisateurs")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!profErr && prof && ["admin", "super_admin"].includes(String(prof.role))) {
        isAdmin = true;
      }
    }
  }

  if (!isAdmin) {
    const aid = (body.admin_id ?? "").trim();
    const acode = normCode(body.admin_code ?? "");
    if (aid && acode) {
      const { data: actor, error: actorErr } = await supabaseAdmin
        .from("utilisateurs")
        .select("role, code_usr")
        .eq("id", aid)
        .maybeSingle();
      if (!actorErr && actor && ["admin", "super_admin"].includes(String(actor.role))) {
        const dbCode = normCode(String(actor.code_usr ?? ""));
        if (dbCode && acode === dbCode) {
          isAdmin = true;
        }
      }
    }
  }

  if (!isAdmin) {
    return json({
      ok: false,
      error:
        "Accès refusé : session admin introuvable ou code admin invalide. Vérifiez votre connexion (email + mot de passe) ou votre code d’accès administrateur.",
    });
  }

  const prenom = (body.prenom ?? "").trim();
  const nom = (body.nom ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const role = (body.role ?? "").trim();
  const code_usr = (body.code_usr ?? "").trim();
  const telephone = body.telephone != null ? String(body.telephone).trim() || null : null;
  const entreprise_nom = body.entreprise_nom != null
    ? String(body.entreprise_nom).trim() || null
    : null;

  if (!email || !email.includes("@")) {
    return json({ ok: false, error: "Email valide requis pour créer le compte Auth." });
  }
  if (!code_usr) {
    return json({ ok: false, error: "Code d’accès (code_usr) manquant." });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return json({ ok: false, error: "Rôle non autorisé." });
  }

  const { data: existingProf } = await supabaseAdmin
    .from("utilisateurs")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProf?.id) {
    return json({
      ok: false,
      error: "Un profil existe déjà pour cet email — utilisez la mise à jour depuis la liste.",
    });
  }

  let userId: string | null = null;

  const pwd = randomPassword();
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pwd,
    email_confirm: true,
    user_metadata: { prenom, nom },
  });

  if (!createErr && created.user?.id) {
    userId = created.user.id;
  } else {
    const msg = (createErr?.message ?? "").toLowerCase();
    const dup =
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("user already registered") ||
      createErr?.status === 422;
    if (dup) {
      userId = await findAuthUserIdByEmail(supabaseAdmin, email);
      if (!userId) {
        return json({
          ok: false,
          error:
            "Cet email existe dans Auth mais l’ID n’a pas pu être retrouvé. Contactez le support.",
        });
      }
    } else {
      console.error("createUser", createErr);
      return json({
        ok: false,
        error: createErr?.message ?? "Création du compte Auth impossible.",
      });
    }
  }

  const { error: insErr } = await supabaseAdmin.from("utilisateurs").insert([
    {
      id: userId,
      prenom: prenom || null,
      nom: nom || null,
      email,
      role,
      code_usr,
      code: code_usr,
      telephone,
      entreprise_nom,
      actif: true,
    },
  ]);

  if (insErr) {
    console.error("utilisateurs insert", insErr);
    return json({
      ok: false,
      error: insErr.message ?? "Insertion du profil impossible.",
    });
  }

  return json({ ok: true, user_id: userId });
});
