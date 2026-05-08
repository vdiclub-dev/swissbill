(function () {
  "use strict";

  var tool = window.BrimotTool;
  var listEl = document.getElementById("historyList");
  var clearBtn = document.getElementById("clearHistory");

  function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("fr-CH");
  }

  function render() {
    var history = tool.loadHistory();
    if (!history.length) {
      listEl.innerHTML = '<div class="empty">Aucun devis enregistre pour le moment.</div>';
      return;
    }

    listEl.innerHTML = history
      .map(function (item) {
        var sourceLabel = item.source === "ai" ? "Assistant IA" : "Dashboard";
        var typeLabel = item.typeLabel || tool.getTypeLabel((item.input && item.input.cleaningType) || "standard");
        var total = tool.formatCHF(item.total || 0);
        var surface = item.input && item.input.surfaceM2 ? item.input.surfaceM2 + " m2" : "-";
        return (
          '<article class="history-item">' +
          '<div class="history-meta">' +
          '<span>' + fmtDate(item.createdAt) + '</span>' +
          '<span class="tag">' + sourceLabel + '</span>' +
          '</div>' +
          '<div class="history-main">' +
          '<div>' +
          '<strong>' + typeLabel + '</strong><br>' +
          '<span class="note">Surface: ' + surface + '</span>' +
          '</div>' +
          '<strong>' + total + '</strong>' +
          '</div>' +
          '</article>'
        );
      })
      .join("");
  }

  clearBtn.addEventListener("click", function () {
    if (!confirm("Supprimer tout l'historique ?")) {
      return;
    }
    tool.clearHistory();
    render();
  });

  render();
})();
