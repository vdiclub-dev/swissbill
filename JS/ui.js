window.UI = {
  toast(message, type = "info") {
    let box = document.getElementById("toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      box.style.position = "fixed";
      box.style.top = "20px";
      box.style.right = "20px";
      box.style.zIndex = "9999";
      document.body.appendChild(box);
    }

    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;
    box.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 3500);
  },

  money(value) {
    return new Intl.NumberFormat("fr-CH", {
      style: "currency",
      currency: "CHF"
    }).format(Number(value || 0));
  },

  formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("fr-CH");
  }
};
