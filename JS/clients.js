console.log("clients.js chargé");

function searchClient() {
  const term = document.getElementById("clientSearch").value.trim();
  const results = document.getElementById("clientResults");

  if (!term) {
    results.innerHTML = "";
    return;
  }

  results.innerHTML = "<div>Recherche : " + term + "</div>";
}

window.searchClient = searchClient;
