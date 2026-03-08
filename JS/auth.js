const sb = window.supabaseClient;

async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = "/login.html";
    return null;
  }
  return session;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = "/login.html";
}

async function getCurrentProfile() {
  const session = await getSession();
  if (!session?.user) return null;

  const { data, error } = await sb
    .from("clients")
    .select("*")
    .eq("auth_user_id", session.user.id)
    .single();

  if (error) throw error;
  return data;
}
