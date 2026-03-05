const $ = (id) => document.getElementById(id);
const db = () => window.supabaseClient;

function show(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"));
  $("page-"+page).classList.add("active");
  document.querySelector(`.nav[data-page="${page}"]`).classList.add("active");
}

async function refreshAll(){
  await Promise.all([loadClients(), loadProducts(), loadInvoices(), loadInvoiceClientSelect(), loadDashboard()]);
async function refreshAll(){

await Promise.all([
loadClients(),
loadProducts(),
loadInvoices(),
loadInvoiceClientSelect(),
loadDashboard()
])

}
}

/* ---------- DASHBOARD ---------- */
async function loadDashboard(){
  const { data: inv } = await db().from("invoices").select("total");
  const { data: cli } = await db().from("clients").select("id");

  const ca = (inv||[]).reduce((s,i)=>s + Number(i.total||0), 0);
  $("kpi-ca").textContent = ca.toFixed(2) + " CHF";
  $("kpi-invoices").textContent = (inv||[]).length;
  $("kpi-clients").textContent = (cli||[]).length;
}

/* ---------- CLIENTS ---------- */
async function loadClients(){
  const { data } = await db().from("clients").select("*").order("created_at",{ascending:false});
  const tbody = $("tblClients");
  tbody.innerHTML = "";
  (data||[]).forEach(c=>{
    tbody.innerHTML += `<tr>
      <td>${c.company||""}</td>
      <td>${c.last_name||""}</td>
      <td>${c.email||""}</td>
    </tr>`;
  });
}

async function addClient(){
  const company = $("c_company").value.trim();
  const last_name = $("c_lastname").value.trim();
  const email = $("c_email").value.trim();

  await db().from("clients").insert([{ company, last_name, email }]);
  $("c_company").value=""; $("c_lastname").value=""; $("c_email").value="";
  await refreshAll();
}

/* ---------- PRODUCTS ---------- */
async function loadProducts(){
  const { data } = await db().from("products").select("*").order("created_at",{ascending:false});
  const tbody = $("tblProducts");
  tbody.innerHTML = "";
  (data||[]).forEach(p=>{
    tbody.innerHTML += `<tr>
      <td>${p.name||""}</td>
      <td>${Number(p.price||0).toFixed(2)} CHF</td>
    </tr>`;
  });
}

async function addProduct(){
  const name = $("p_name").value.trim();
  const price = Number(($("p_price").value||"0").replace(",", "."));

  if(!name) return alert("Nom du produit manquant");
  await db().from("products").insert([{ name, price }]);
  $("p_name").value=""; $("p_price").value="";
  await refreshAll();
}

/* ---------- INVOICES ---------- */
async function loadInvoiceClientSelect(){
  const { data } = await db().from("clients").select("id,company,last_name").order("created_at",{ascending:false});
  const sel = $("i_client");
  sel.innerHTML = "";
  (data||[]).forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.company || c.last_name || c.id;
    sel.appendChild(opt);
  });
}

async function loadInvoices(){
  const { data } = await db()
    .from("invoices")
    .select("id,total,created_at, clients(company,last_name)")
    .order("created_at",{ascending:false});

  const tbody = $("tblInvoices");
  tbody.innerHTML = "";
  (data||[]).forEach(i=>{
    const d = new Date(i.created_at);
    const client = i.clients?.company || i.clients?.last_name || "";
    tbody.innerHTML += `<tr>
      <td>${d.toLocaleDateString("fr-CH")}</td>
      <td>${client}</td>
      <td>${Number(i.total||0).toFixed(2)} CHF</td>
    </tr>`;
  });
}

async function addInvoice(){

const client_id = document.getElementById("i_client").value
const amount = Number(document.getElementById("i_total").value)

if(!client_id) return alert("Choisir un client")
if(!amount) return alert("Montant invalide")

/* récupérer dernière facture */

let { data } = await db()
.from("invoices")
.select("invoice_number")
.order("invoice_number",{ascending:false})
.limit(1)

/* numéro suivant */

let nextNumber = 1

if(data && data.length>0){
nextNumber = parseInt(data[0].invoice_number)+1
}

/* format 2026-0001 */

const year = new Date().getFullYear()
const invoice_number = year + "-" + String(nextNumber).padStart(4,"0")

/* TVA suisse */

const tva = amount * 0.081
const total = amount + tva

await db().from("invoices").insert([{
client_id,
invoice_number,
total,
tva
}])

document.getElementById("i_total").value=""

await refreshAll()

alert("Facture "+invoice_number+" créée")

}
async function loadInvoices(){

const { data } = await db()
.from("invoices")
.select("invoice_number,total,created_at, clients(company,last_name)")
.order("created_at",{ascending:false})

const tbody = document.getElementById("tblInvoices")

tbody.innerHTML = ""

data.forEach(i => {

const date = new Date(i.created_at)

const client =
i.clients?.company ||
i.clients?.last_name ||
""

let row = `
<tr>
<td>${i.invoice_number}</td>
<td>${date.toLocaleDateString("fr-CH")}</td>
<td>${client}</td>
let row = `
<tr>
<td>${i.invoice_number}</td>
<td>${date.toLocaleDateString("fr-CH")}</td>
<td>${client}</td>
<td>${Number(i.total).toFixed(2)} CHF</td>
<td>
<button onclick="generatePDF('${i.invoice_number}','${client}','${i.total}')">
PDF
</button>
</td>
</tr>
`

tbody.innerHTML += row

})

}
function generatePDF(number,client,total){

const { jsPDF } = window.jspdf

const doc = new jsPDF()

doc.setFontSize(20)
doc.text("SwissBill",20,20)

doc.setFontSize(12)

doc.text("Facture : "+number,20,50)
doc.text("Client : "+client,20,60)

doc.text("Montant : "+Number(total).toFixed(2)+" CHF",20,80)

doc.save("facture_"+number+".pdf")

}
// ===============================
// CONFIG QR-FACTURE (A REMPLIR)
// ===============================
// IMPORTANT: mets ici TON IBAN + TON adresse (format structuré)
// Après 21.11.2025, les adresses structurées sont requises. :contentReference[oaicite:0]{index=0}

const QR_CREDITOR = {
  iban: "CH00....",                 // <-- TON IBAN (pas QR-IBAN si tu n'utilises pas de référence QRR)
  name: "Brimot Nettoyage",         // ou "Didier Gysling"
  street: "Impasse des Griottes",
  building: "3",
  postal: "1462",
  city: "Yvonand",
  country: "CH",
};

// ===============================
// QR-FACTURE : PAYLOAD SPC (Swiss Payments Code)
// ===============================
// Structure basée sur les Implementation Guidelines QR-bill (SPC/0200). :contentReference[oaicite:1]{index=1}
function buildSwissQRPayload({ invoice_number, amountCHF, message }) {
  const amt = Number(amountCHF || 0).toFixed(2);

  const lines = [
    "SPC",
    "0200",
    "1",
    QR_CREDITOR.iban,

    // Creditor (CR) - Address type S (structured)
    "S",
    QR_CREDITOR.name,
    QR_CREDITOR.street,
    QR_CREDITOR.building,
    QR_CREDITOR.postal,
    QR_CREDITOR.city,
    QR_CREDITOR.country,

    // Ultimate creditor (UCR) - empty (reserved)
    "", "", "", "", "", "", "",

    // Amount + Currency
    amt,
    "CHF",

    // Ultimate debtor (UD) - optional, leave empty (we don't have debtor address fields yet)
    "", "", "", "", "", "", "",

    // Reference type + Reference (NON = no reference)
    "NON",
    "",

    // Unstructured message (ex: facture)
    message || `Facture ${invoice_number}`,

    // Trailer
    "EPD",

    // Billing information (optional)
    "",

    // Alternative procedures (optional, up to 2 lines)
    "",
    "",
  ];

  return lines.join("\n");
}

// ===============================
// QR CODE -> DataURL (pour PDF)
// ===============================
function qrToDataURL(text) {
  return new Promise((resolve) => {
    const tmp = document.createElement("div");
    tmp.style.position = "fixed";
    tmp.style.left = "-9999px";
    tmp.style.top = "-9999px";
    document.body.appendChild(tmp);

    const qr = new QRCode(tmp, {
      text,
      width: 240,
      height: 240,
      correctLevel: QRCode.CorrectLevel.M,
    });

    // attendre le rendu
    setTimeout(() => {
      const img = tmp.querySelector("img");
      if (img && img.src) {
        resolve(img.src);
      } else {
        const canvas = tmp.querySelector("canvas");
        resolve(canvas ? canvas.toDataURL("image/png") : null);
      }
      tmp.remove();
    }, 80);
  });
}

// ===============================
// PDF + QR-FACTURE (bouton PDF)
// ===============================
// Remplace/écrase ta fonction generatePDF existante par celle-ci.
// (si tu as déjà generatePDF, colle celle-ci en dessous -> elle prendra le dessus)
async function generatePDF(invoice_number) {
  // récupérer la facture + client
  const { data, error } = await db()
    .from("invoices")
    .select("invoice_number,total,tva,created_at, clients(company,last_name,email)")
    .eq("invoice_number", invoice_number)
    .limit(1)
    .single();

  if (error || !data) {
    alert("Impossible de charger la facture");
    return;
  }

  const inv = data;
  const clientName =
    inv.clients?.company ||
    inv.clients?.last_name ||
    "";

  const ht = (Number(inv.total) - Number(inv.tva || 0));
  const tva = Number(inv.tva || 0);
  const ttc = Number(inv.total || 0);

  // payload Swiss QR
  const payload = buildSwissQRPayload({
    invoice_number: inv.invoice_number,
    amountCHF: ttc,
    message: `Facture ${inv.invoice_number} - ${clientName}`,
  });

  const qrDataUrl = await qrToDataURL(payload);

  // PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("SwissBill", 20, 20);

  doc.setFontSize(12);
  doc.text(`Facture : ${inv.invoice_number}`, 20, 40);
  doc.text(`Date : ${new Date(inv.created_at).toLocaleDateString("fr-CH")}`, 20, 48);
  doc.text(`Client : ${clientName}`, 20, 56);

  doc.text(`Total HT : ${ht.toFixed(2)} CHF`, 20, 76);
  doc.text(`TVA 8.1% : ${tva.toFixed(2)} CHF`, 20, 84);
  doc.text(`Total TTC : ${ttc.toFixed(2)} CHF`, 20, 92);

  doc.text("QR-facture (paiement)", 20, 120);

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 20, 130, 60, 60);
  } else {
    doc.text("QR non généré", 20, 140);
  }

  doc.save(`facture_${inv.invoice_number}.pdf`);
}
