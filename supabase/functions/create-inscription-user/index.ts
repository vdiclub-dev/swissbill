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
 * Secrets : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (hébergeur),
 *           BREVO_API_KEY, NOTIFY_FROM_EMAIL.
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

function parseSender(value: string): { email: string; name?: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, "");
    return { email: match[2].trim(), ...(name ? { name } : {}) };
  }
  return { email: trimmed };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendAccessCodeEmail(args: {
  to: string;
  prenom: string;
  nom: string;
  role: string;
  code: string;
}): Promise<{ sent: boolean; error?: string }> {
  const brevoKey = Deno.env.get("BREVO_API_KEY")?.trim();
  const from = (Deno.env.get("NOTIFY_FROM_EMAIL") ?? "Colixo <info@colixo.ch>").trim();
  if (!brevoKey) return { sent: false, error: "BREVO_API_KEY manquant" };

  const displayName = [args.prenom, args.nom].filter(Boolean).join(" ").trim() || "Bonjour";
  const roleLabel: Record<string, string> = {
    client: "Client",
    chauffeur: "Chauffeur",
    magasinier: "Magasinier",
    admin: "Administrateur",
  };
  const loginUrl = "https://www.colixo.ch/login/";
  const subject = "Votre accès Colixo est prêt";
  const text =
    `Bonjour ${displayName},\n\n` +
    `Votre demande d'accès à la plateforme Colixo a été validée.\n\n` +
    `Votre code d'accès personnel : ${args.code}\n\n` +
    `Rôle attribué : ${roleLabel[args.role] || args.role}\n\n` +
    `Pour vous connecter, rendez-vous sur :\n${loginUrl}\n\n` +
    `Conservez ce code en lieu sûr et ne le partagez avec personne.\n\n` +
    `Bienvenue sur Colixo,\n` +
    `L'équipe Colixo\n`;
  const html =
    `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:620px;">` +
    `<div style="font-size:22px;font-weight:800;color:#e8311a;margin-bottom:14px;">Colixo</div>` +
    `<p>Bonjour ${escapeHtml(displayName)},</p>` +
    `<p>Votre demande d'accès à la plateforme Colixo a été validée.</p>` +
    `<div style="background:#111827;color:#fff;border-radius:12px;padding:18px;margin:20px 0;text-align:center;">` +
    `<div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#fca5a5;margin-bottom:8px;">Votre code d'accès</div>` +
    `<div style="font-size:30px;font-weight:800;letter-spacing:2px;font-family:monospace;">${escapeHtml(args.code)}</div>` +
    `</div>` +
    `<p><strong>Rôle attribué :</strong> ${escapeHtml(roleLabel[args.role] || args.role)}</p>` +
    `<p><a href="${loginUrl}" style="display:inline-block;background:#e8311a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Accéder à Colixo</a></p>` +
    `<p style="font-size:13px;color:#6b7280;">Conservez ce code en lieu sûr et ne le partagez avec personne.</p>` +
    `<p style="margin-top:22px;">Bienvenue sur Colixo,<br><strong>L'équipe Colixo</strong></p>` +
    `</div>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(from),
      to: [{ email: args.to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { sent: false, error: `Brevo ${res.status}: ${errBody}` };
  }
  return { sent: true };
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

  const { data: existingProf, error: existingErr } = await supabaseAdmin
    .from("utilisateurs")
    .select("id, code_usr, code")
    .eq("email", email)
    .maybeSingle();
  if (existingErr) {
    console.error("existing utilisateurs lookup", existingErr);
    return json({ ok: false, error: existingErr.message ?? "Lecture du profil impossible." });
  }
  if (existingProf?.id) {
    const existingCode = (existingProf.code_usr || existingProf.code || code_usr).trim();
    const { error: updErr } = await supabaseAdmin.from("utilisateurs").update({
      role,
      actif: true,
      code_usr: existingCode,
      code: existingCode,
      prenom: prenom || null,
      nom: nom || null,
      telephone,
      entreprise_nom,
    }).eq("id", existingProf.id);
    if (updErr) {
      console.error("utilisateurs update existing", updErr);
      return json({
        ok: false,
        error: updErr.message ?? "Mise à jour du profil impossible.",
      });
    }
    const mail = await sendAccessCodeEmail({ to: email, prenom, nom, role, code: existingCode });
    if (!mail.sent) console.error("access code email existing", mail.error);
    return json({
      ok: true,
      user_id: existingProf.id,
      code_usr: existingCode,
      existing_profile: true,
      mail_sent: mail.sent,
      mail_error: mail.error ?? null,
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

  const mail = await sendAccessCodeEmail({ to: email, prenom, nom, role, code: code_usr });
  if (!mail.sent) console.error("access code email new", mail.error);
  return json({ ok: true, user_id: userId, code_usr, mail_sent: mail.sent, mail_error: mail.error ?? null });
});
