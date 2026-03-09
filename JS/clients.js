console.log("clients.js chargé");

async function searchClient() {
  const input = document.getElementById("clientSearch");
  const results = document.getElementById("clientResults");

  if (!input || !results) return;

  const term = input.value.trim();

  if (term.length < 2) {
    results.innerHTML = "";
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("clients")
      .select("id, company, first_name, last_name, address, city")
      .or(
        `company.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`
      )
      .limit(10);

    if (error) {
      console.error("Erreur recherche client :", error);
      results.innerHTML = "";
      return;
    }

    if (!data || data.length === 0) {
      results.innerHTML = '<div class="client-item">Aucun client trouvé</div>';
      return;
    }

    let html = "";

    data.forEach((c) => {
      const label =
        c.company && c.company.trim() !== ""
          ? c.company
          : `${c.first_name || ""} ${c.last_name || ""}`.trim();

      const fullAddress = [c.address || "", c.city || ""].join(", ").trim();

      html += `
        <div class="client-item"
             onclick="selectClient(
               '${escapeQuotes(label)}',
               '${escapeQuotes(c.address || "")}',
               '${escapeQuotes(c.city || "")}'
             )">
          <strong>${label}</strong><br>
          <small>${fullAddress}</small>
        </div>
      `;
    });

    results.innerHTML = html;
  } catch (e) {
    console.error("Erreur clients.js :", e);
    results.innerHTML = "";
  }
}

function selectClient(name, address, city) {
  const input = document.getElementById("clientSearch");
  const pickup = document.getElementById("pickup_address");
  const results = document.getElementById("clientResults");

  if (input) input.value = name;

  const fullAddress = [address || "", city || ""].join(", ").trim();

  if (pickup) {
    pickup.value = fullAddress;
  }

  if (results) {
    results.innerHTML = "";
  }

  if (typeof calculateDistance === "function") {
    calculateDistance();
  }
}

function escapeQuotes(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

window.searchClient = searchClient;
window.selectClient = selectClient;
