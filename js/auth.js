async function requireAuth() {
  const { data, error } = await window.SUPABASE_CLIENT.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "login/index.html";
    return null;
  }
  return data.user;
}

async function getCurrentProfile() {
  const user = await requireAuth();
  if (!user) return null;

  const { data, error } = await window.SUPABASE_CLIENT
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getActiveCgvVersion() {
  const { data, error } = await window.SUPABASE_CLIENT
    .from("cgv_versions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || {
    version_code: "v1.0_colixo_2026",
    title: "Conditions Générales de Transport Colixo",
    content_html: "<p>Aucune version active trouvée.</p>"
  };
}
