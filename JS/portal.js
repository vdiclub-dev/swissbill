const sbPortal = window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const session = await requireAuth();
    if (!session) return;

    const profile = await getClientProfile();
    if (!profile) throw new Error("Profil introuvable.");

    const welcome = document.getElementById("welcomeName");
    if (welcome) {
      welcome.textContent = profile.entreprise || profile.nom || "Client";
    }

    const clientInfo = document.getElementById("clientInfo");
    if (clientInfo) {
      clientInfo.innerHTML = `
        <strong>${profile.entreprise || ""}</strong><br>
        ${profile.nom || ""}<br>
        ${profile.email || ""}<br>
        ${profile.telephone || ""}<br>
        N° client : ${profile.client_number || "-"}
      `;
    }

    const { data: orders, error } = await sbPortal
      .from("orders")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const currentCount = (orders || []).filter(o => !["livré", "annulé"].includes((o.status || "").toLowerCase())).length;
    const deliveredCount = (orders || []).filter(o => (o.status || "").toLowerCase() === "livré").length;

    const activeEl = document.getElementById("activeOrders");
    const deliveredEl = document.getElementById("deliveredOrders");
    const listEl = document.getElementById("ordersList");

    if (activeEl) activeEl.textContent = currentCount;
    if (deliveredEl) deliveredEl.textContent = deliveredCount;

    if (listEl) {
      if (!orders || orders.length === 0) {
        listEl.innerHTML = `<div class="empty-box">Aucun transport enregistré pour le moment.</div>`;
      } else {
        listEl.innerHTML = orders.map(order => `
          <div class="order-card">
            <div class="order-top">
              <div>
                <strong>${order.order_number}</strong><br>
                ${order.pickup_city || "-"} → ${order.delivery_city || "-"}
              </div>
              <div class="status-badge">${order.status || "nouveau"}</div>
            </div>

            <div class="order-grid">
              <div><strong>Type :</strong> ${order.package_type || "-"}</div>
              <div><strong>Vitesse :</strong> ${order.speed || "-"}</div>
              <div><strong>Prix estimé :</strong> ${UI.money(order.estimated_price)}</div>
              <div><strong>Date :</strong> ${UI.formatDate(order.created_at)}</div>
            </div>
          </div>
        `).join("");
      }
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }
  } catch (err) {
    UI.toast(err.message || "Erreur portail", "error");
  }
});
function showPage(page){

document.querySelectorAll(".page")
.forEach(p=>p.style.display="none")

document.getElementById(page).style.display="block"

}
