const colixoPdfLogoCache = { promise: null };

function colixoAssetUrl(path) {
  const p = typeof window.colixoHref === "function" ? window.colixoHref(path) : path;
  try { return new URL(p, window.location.href).href; }
  catch (e) { return p; }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadColixoPdfLogo() {
  if (colixoPdfLogoCache.promise) return colixoPdfLogoCache.promise;
  colixoPdfLogoCache.promise = (async () => {
    const candidates = [
      colixoAssetUrl("/images/colixo-logo-print.png"),
      colixoAssetUrl("/images/colixo-logo.png"),
      "images/colixo-logo-print.png"
    ];
    for (const url of candidates) {
      try {
        const response = await fetch(url);
        if (response.ok) return await blobToDataUrl(await response.blob());
      } catch (e) {
        console.warn("Logo PDF Colixo indisponible", url, e);
      }
    }
    return null;
  })();
  return colixoPdfLogoCache.promise;
}

async function generateSignedOrderPdf(order, cgv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logoDataUrl = await loadColixoPdfLogo();

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 15, 10, 24, 24);
    } catch (e) {
      console.warn("Logo PDF Colixo non inséré", e);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("COLIXO", 15, 18);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const headX = logoDataUrl ? 44 : 15;
  doc.text("Transport & Logistique Suisse", headX, 20);
  doc.text(window.COLIXO_APP.companyWebsite, headX, 25);
  doc.text(window.COLIXO_APP.companyEmail, headX, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Confirmation de transport signee", 15, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let y = 58;
  const lineGap = 7;

  const rows = [
    ["Reference", order.reference || ""],
    ["Client", order.signature_name || ""],
    ["Date signature", order.signed_at ? new Date(order.signed_at).toLocaleString("fr-CH") : ""],
    ["Adresse enlèvement", order.pickup_address || ""],
    ["Adresse livraison", order.delivery_address || ""],
    ["Type colis", order.package_type || ""],
    ["Poids", order.package_weight ? `${order.package_weight} kg` : ""],
    ["Valeur declaree", order.declared_value ? `CHF ${Number(order.declared_value).toFixed(2)}` : "CHF 0.00"],
    ["Service", order.service_level || ""],
    ["Prix HT", `CHF ${Number(order.price_ht || 0).toFixed(2)}`],
    ["TVA", `${Number(order.tva_rate || 0).toFixed(1)} %`],
    ["Prix TTC", `CHF ${Number(order.price_ttc || 0).toFixed(2)}`],
    ["Version CGV", order.cgv_version || ""]
  ];

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 60, y);
    y += lineGap;
  });

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Clauses essentielles", 15, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  const clauses = [
    "Responsabilite limitee a 500 CHF par colis sauf accord ecrit contraire.",
    "Les delais de livraison sont indicatifs et non garantis.",
    "Toute reclamation doit etre formulee dans les 24 heures.",
    "Aucune assurance n'est incluse sauf mention ecrite contraire.",
    "Colixo n'est pas responsable des pertes indirectes."
  ];

  clauses.forEach((clause) => {
    const lines = doc.splitTextToSize(`- ${clause}`, 175);
    doc.text(lines, 18, y);
    y += lines.length * 5 + 1;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Acceptation", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const acceptText = doc.splitTextToSize(
    `Je soussigne confirme avoir pris connaissance des Conditions Generales de Transport Colixo (${order.cgv_version || ""}) et accepter les limitations de responsabilite applicables au transport commande.`,
    180
  );
  doc.text(acceptText, 15, y);
  y += acceptText.length * 5 + 8;

  if (order.signature_data) {
    doc.setFont("helvetica", "bold");
    doc.text("Signature client", 15, y);
    y += 4;
    doc.addImage(order.signature_data, "PNG", 15, y, 70, 28);
  }

  doc.setFontSize(8);
  doc.text("Document genere automatiquement par Colixo.", 15, 287);

  return doc.output("blob");
}

async function uploadSignedPdf(orderId, pdfBlob) {
  const path = `signed-orders/${orderId}.pdf`;

  const { error: uploadError } = await supabase
    .storage
    .from("contracts")
    .upload(path, pdfBlob, {
      upsert: true,
      contentType: "application/pdf"
    });

  if (uploadError) throw uploadError;

  const { data } = supabase
    .storage
    .from("contracts")
    .getPublicUrl(path);

  return data?.publicUrl || null;
}
