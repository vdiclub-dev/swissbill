async function loadDashboard(){

  const invRes = await window.supabaseClient
    .from("invoices")
    .select("total");

  const cliRes = await window.supabaseClient
    .from("clients")
    .select("id");

  const inv = invRes.data || [];
  const cli = cliRes.data || [];

  const ca = inv.reduce((s,i)=> s + Number(i.total || 0),0);

  document.getElementById("kpi-ca").textContent =
    ca.toFixed(2) + " CHF";

  document.getElementById("kpi-invoices").textContent =
    inv.length;

  document.getElementById("kpi-clients").textContent =
    cli.length;
}
