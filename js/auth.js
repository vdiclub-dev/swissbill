(function () {
  "use strict";

  function getDb() {
    return window.SUPABASE_CLIENT || window.supabaseClient || null;
  }

  function href(path) {
    if (typeof window.colixoHref === "function") return window.colixoHref(path);
    return path;
  }

  function loginUrl() {
    return href("/login/index.html");
  }

  function normalizeRoles(roles) {
    return Array.isArray(roles) ? roles.filter(Boolean) : [];
  }

  function roleHome(role) {
    var routes = {
      super_admin: "/admin/dashboard.html",
      admin: "/admin/dashboard.html",
      chauffeur: "/admin/driver-app.html",
      magasinier: "/magasinier/dashboard.html",
      client: "/admin/client/portal.html",
      gestionnaire: "/admin/client/portal.html",
      comptable: "/admin/client/portal.html",
      sous_utilisateur: "/admin/client/portal.html"
    };
    return href(routes[role] || "/admin/client/portal.html");
  }

  function clearLegacyUser() {
    try {
      localStorage.removeItem("colixo_user");
    } catch (e) {}
    try {
      localStorage.removeItem("colixo_access_code");
    } catch (e) {}
  }

  function syncLegacyUser(profile) {
    if (!profile || !profile.id) return;
    try {
      localStorage.setItem(
        "colixo_user",
        JSON.stringify({
          id: profile.id,
          role: profile.role || null,
          nom: profile.nom || null,
          prenom: profile.prenom || null,
          code: profile.code_usr || profile.code || profile.code_acces || profile.code_connexion || getLegacyCode() || null,
          entreprise_id: profile.entreprise_id || null
        })
      );
    } catch (e) {}
  }

  function readLegacyUser() {
    try {
      var raw = localStorage.getItem("colixo_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getLegacyCode() {
    var legacyUser = readLegacyUser();
    var code = legacyUser && (legacyUser.code || legacyUser.code_usr || legacyUser.code_acces || legacyUser.code_connexion);
    if (!code) {
      try {
        code = localStorage.getItem("colixo_access_code");
      } catch (e) {}
    }
    return code ? String(code).trim().toUpperCase() : null;
  }

  function firstRow(data) {
    return Array.isArray(data) ? data[0] || null : data || null;
  }

  async function getVerifiedSession() {
    var db = getDb();
    if (!db) return { session: null, authUser: null };

    var sessionRes = await db.auth.getSession();
    var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
    if (!session) return { session: null, authUser: null };

    var userRes = await db.auth.getUser();
    var authUser = userRes && userRes.data ? userRes.data.user : null;

    if (!authUser) {
      try {
        await db.auth.signOut();
      } catch (e) {}
      return { session: null, authUser: null };
    }

    return { session: session, authUser: authUser };
  }

  async function loadProfileFromAuth(authUser) {
    var db = getDb();
    if (!db || !authUser) {
      return { profile: null, lookup: null, mismatch: false };
    }

    var byId = await db
      .from("utilisateurs")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) {
      return { profile: byId.data, lookup: "id", mismatch: false };
    }

    if (!authUser.email) {
      return { profile: null, lookup: "id", mismatch: false };
    }

    var byEmail = await db
      .from("utilisateurs")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;

    return {
      profile: byEmail.data || null,
      lookup: byEmail.data ? "email" : null,
      mismatch: !!byEmail.data
    };
  }

  async function loadLegacyProfile(legacyRoles) {
    var allowed = normalizeRoles(legacyRoles);
    if (!allowed.length) return null;

    var legacyUser = readLegacyUser();
    if (!legacyUser || !legacyUser.id || !legacyUser.role) return null;
    if (allowed.indexOf(legacyUser.role) === -1) return null;

    var db = getDb();
    if (!db) return null;

    var legacyCode = getLegacyCode();
    if (!legacyCode) {
      clearLegacyUser();
      return null;
    }

    var res = await db.rpc("get_code_user_profile", {
      p_user_id: legacyUser.id,
      p_code: legacyCode
    });
    if (res.error) throw res.error;

    var profile = firstRow(res.data);
    if (!profile || profile.actif === false) {
      clearLegacyUser();
      return null;
    }
    if (allowed.indexOf(profile.role) === -1) {
      clearLegacyUser();
      return null;
    }

    syncLegacyUser(profile);
    return {
      session: null,
      authUser: null,
      profile: profile,
      userId: profile.id,
      role: profile.role,
      isLegacy: true,
      mismatch: false,
      profileLookup: "legacy"
    };
  }

  async function colixoGetAuthContext(options) {
    var opts = options || {};
    var routeRoles = normalizeRoles(opts.roles);
    var legacyRoles = normalizeRoles(opts.legacyRoles);

    var sessionCtx = await getVerifiedSession();
    if (sessionCtx.authUser) {
      var profileCtx = await loadProfileFromAuth(sessionCtx.authUser);
      var profile = profileCtx.profile;

      if (profile && profile.actif === false) {
        try {
          await getDb().auth.signOut();
        } catch (e) {}
        clearLegacyUser();
        return null;
      }

      if (profile) {
        syncLegacyUser(profile);
      }

      if (!profile) {
        return {
          session: sessionCtx.session,
          authUser: sessionCtx.authUser,
          profile: null,
          userId: sessionCtx.authUser.id,
          role: null,
          isLegacy: false,
          mismatch: false,
          profileLookup: null
        };
      }

      if (!routeRoles.length || routeRoles.indexOf(profile.role) !== -1) {
        return {
          session: sessionCtx.session,
          authUser: sessionCtx.authUser,
          profile: profile,
          userId: profile.id,
          role: profile.role,
          isLegacy: false,
          mismatch: profileCtx.mismatch,
          profileLookup: profileCtx.lookup
        };
      }

      return {
        session: sessionCtx.session,
        authUser: sessionCtx.authUser,
        profile: null,
        userId: profile.id,
        role: profile.role,
        isLegacy: false,
        mismatch: profileCtx.mismatch,
        profileLookup: profileCtx.lookup,
        roleMismatch: true
      };
    }

    return loadLegacyProfile(legacyRoles);
  }

  async function colixoRequireRoute(options) {
    var opts = options || {};
    var ctx = await colixoGetAuthContext(opts);
    if (ctx && ctx.profile) return ctx;

    if (opts.redirectOnFail === false) return null;

    var target = ctx && ctx.roleMismatch && ctx.role ? roleHome(ctx.role) : (opts.redirectTo || loginUrl());
    window.location.replace(target);
    return null;
  }

  async function colixoLogout(options) {
    var db = getDb();
    if (db) {
      try {
        await db.auth.signOut();
      } catch (e) {}
    }
    clearLegacyUser();

    var opts = options || {};
    if (opts.redirectTo !== false) {
      window.location.replace(opts.redirectTo || loginUrl());
    }
  }

  async function requireAuth() {
    var ctx = await colixoRequireRoute({ redirectTo: loginUrl() });
    if (!ctx || !ctx.authUser) return null;
    return ctx.authUser;
  }

  async function getCurrentProfile() {
    var ctx = await colixoGetAuthContext({});
    return ctx ? ctx.profile : null;
  }

  async function getActiveCgvVersion() {
    var db = getDb();
    if (!db) throw new Error("Client Supabase indisponible");

    var res = await db
      .from("cgv_versions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (res.error) throw res.error;

    return (
      res.data || {
        version_code: "v1.0_colixo_2026",
        title: "Conditions Generales de Transport Colixo",
        content_html: "<p>Aucune version active trouvee.</p>"
      }
    );
  }

  if (getDb() && getDb().auth && typeof getDb().auth.onAuthStateChange === "function") {
    getDb().auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") {
        clearLegacyUser();
      }
    });
  }

  window.colixoRoleHome = roleHome;
  window.colixoLogout = colixoLogout;
  window.colixoGetAuthContext = colixoGetAuthContext;
  window.colixoRequireRoute = colixoRequireRoute;
  window.colixoGetStoredCode = getLegacyCode;
  window.requireAuth = requireAuth;
  window.getCurrentProfile = getCurrentProfile;
  window.getActiveCgvVersion = getActiveCgvVersion;
})();
