function db() {
  return window.supabaseClient;
}

document.addEventListener("DOMContentLoaded", () => {

  console.log("SwissBill démarré");

});

window.supabaseClient = createClient(
  "https://iubbsnntcreneakbdkmv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"
);




function show(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"));

  const section = $("page-"+page);
  const btn = document.querySelector(`.nav[data-page="${page}"]`);

  if(section) section.classList.add("active");
  if(btn) btn.classList.add("active");
}

async function refreshAll(){
  await Promise.allSettled([
    loadClients(),
    loadProducts(),
    loadInvoices(),
    loadInvoiceClientSelect(),
    loadDashboard()
  ]);
}

// ========= dashboard =========
async function loadDashboard(){
  const invRes = await db().from("invoices").select("total");
  const cliRes = await db().from("clients").select("id");

  if(invRes.error) console.log("Dashboard invoices error:", invRes.error);
  if(cliRes.error) console.log("Dashboard clients error:", cliRes.error);

  const inv = invRes.data || [];
  const cli = cliRes.data || [];

  const ca = inv.reduce((s,i)=> s + Number(i.total||0), 0);

  const caEl = $("kpi-ca");
  const invEl = $("kpi-invoices");
  const cliEl = $("kpi-clients");

  if(caEl) caEl.textContent = ca.toFixed(2) + " CHF";
  if(invEl) invEl.textContent = inv.length;
  if(cliEl) cliEl.textContent = cli.length;
}



async function addClient(){
  const company = ($("c_company")?.value||"").trim();
  const last_name = ($("c_lastname")?.value||"").trim();
  const email = ($("c_email")?.value||"").trim();

  const res = await db().from("clients").insert([{ company, last_name, email }]);
  if(res.error){ console.log("addClient error:", res.error); alert("Erreur création client"); return; }

  if($("c_company")) $("c_company").value="";
  if($("c_lastname")) $("c_lastname").value="";
  if($("c_email")) $("c_email").value="";

  await refreshAll();
}

// ========= products =========
async function loadProducts(){
  const res = await db().from("products").select("*").order("created_at",{ascending:false});
  if(res.error){ console.log("loadProducts error:", res.error); return; }

  const tbody = $("tblProducts");
  if(!tbody) return;

  tbody.innerHTML = "";
  (res.data||[]).forEach(p=>{
    tbody.innerHTML += `<tr>
      <td>${p.name||""}</td>
      <td>${Number(p.price||0).toFixed(2)} CHF</td>
    </tr>`;
  });
}

async function addProduct(){
  const name = ($("p_name")?.value||"").trim();
  const price = Number((($("p_price")?.value||"0")).replace(",", "."));
  if(!name) return alert("Nom du produit manquant");

  const res = await db().from("products").insert([{ name, price }]);
  if(res.error){ console.log("addProduct error:", res.error); alert("Erreur création produit"); return; }

  if($("p_name")) $("p_name").value="";
  if($("p_price")) $("p_price").value="";

  await refreshAll();
}



async function addInvoice(){
  const client_id = $("i_client")?.value;
  const ht = Number((($("i_total")?.value||"0")).replace(",", "."));

  if(!client_id) return alert("Choisis un client");
  if(!ht) return alert("Montant invalide");

  // dernier numéro
  const lastRes = await db()
    .from("invoices")
    .select("invoice_number,created_at")
    .order("created_at",{ascending:false})
    .limit(1);

  if(lastRes.error){
    console.log("last invoice error:", lastRes.error);
    alert("Erreur lecture factures (F12 Console)");
    return;
  }

  let next = 1;
  if(lastRes.data && lastRes.data.length && lastRes.data[0].invoice_number){
    const last = String(lastRes.data[0].invoice_number).split("-").pop();
    const n = parseInt(last, 10);
    if(!isNaN(n)) next = n + 1;
  }

  const year = new Date().getFullYear();
  const invoice_number = `${year}-${String(next).padStart(4,"0")}`;

  const tva = ht * 0.081;
  const total = ht + tva;

  const insRes = await db().from("invoices").insert([{ client_id, invoice_number, tva, total }]);
  if(insRes.error){
    console.log("addInvoice error:", insRes.error);
    alert("Facture NON créée (F12 Console)");
    return;
  }

  if($("i_total")) $("i_total").value="";
  await refreshAll();
  alert("Facture " + invoice_number + " créée ✅");
}

async function loadInvoices(){
  const res = await db()
    .from("invoices")
    .select("invoice_number,total,tva,created_at,client_id")
    .order("created_at",{ascending:false});

  if(res.error){ console.log("loadInvoices error:", res.error); return; }

  // map clients
  const cl = await db().from("clients").select("id,company,last_name");
  const map = new Map((cl.data||[]).map(c => [c.id, (c.company || c.last_name || "")]));

  const tbody = $("tblInvoices");
  if(!tbody) return;

  tbody.innerHTML = "";
  (res.data||[]).forEach(i=>{
    const d = new Date(i.created_at);
    const client = map.get(i.client_id) || "";
    tbody.innerHTML += `<tr>
      <td>${i.invoice_number||""}</td>
      <td>${d.toLocaleDateString("fr-CH")}</td>
      <td>${client}</td>
      <td>${Number(i.total||0).toFixed(2)} CHF</td>
      <td><button onclick="alert('PDF étape suivante')">PDF</button></td>
    </tr>`;
  });
}

// ========= invoice items UI (ne casse jamais) =========
function addInvoiceRow(){
  const tbody = document.querySelector("#invoiceItems tbody");
  if(!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="prod" placeholder="Produit"></td>
    <td><input class="qty" type="number" value="1" min="0"></td>
    <td>
      <select class="unit">
        <option>h</option><option>m2</option><option>m3</option>
        <option>kg</option><option>pièce</option><option>forfait</option><option>km</option>
      </select>
    </td>
    <td><input class="price" type="number" value="0" min="0"></td>
    <td class="total">0.00</td>
  `;
  tbody.appendChild(tr);

  const recalc = () => {
    const qty = Number(tr.querySelector(".qty").value || 0);
    const price = Number(tr.querySelector(".price").value || 0);
    tr.querySelector(".total").textContent = (qty * price).toFixed(2);
  };

  tr.querySelector(".qty").addEventListener("input", recalc);
  tr.querySelector(".price").addEventListener("input", recalc);
  recalc();
}

// ========= boot =========
document.addEventListener("DOMContentLoaded", async ()=>{
  // sécurité: si supabaseClient n'existe pas, on affiche une alerte claire
  if(!window.supabaseClient){
    alert("Supabase non chargé (vérifie supabase.js dans index.html)");
    return;
  }

  document.querySelectorAll(".nav").forEach(b=>{
    b.addEventListener("click", ()=> show(b.dataset.page));
  });

  $("btnAddClient")?.addEventListener("click", addClient);
  $("btnAddProduct")?.addEventListener("click", addProduct);
  $("btnAddInvoice")?.addEventListener("click", addInvoice);

  show("dashboard");
  await refreshAll();
});

// ========= clients =========
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

// ========= products =========
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

// ========= invoices (TVA + numéro 2026-0001) =========
async function loadInvoiceClientSelect(){

const { data } = await db()
.from("clients")
.select("id,company,last_name")
.order("created_at",{ascending:false})

const sel = document.getElementById("i_client")

sel.innerHTML = ""

data.forEach(c=>{

const opt = document.createElement("option")

opt.value = c.id
opt.textContent = c.company || c.last_name

sel.appendChild(opt)

})

}

async function addInvoice(){
  const client_id = $("i_client").value;
  const ht = Number(($("i_total").value||"0").replace(",", "."));

  if(!client_id) return alert("Choisis un client");
  if(!ht) return alert("Montant invalide");

  // dernier numéro
  const lastRes = await db()
    .from("invoices")
    .select("invoice_number,created_at")
    .order("created_at",{ascending:false})
    .limit(1);

  if(lastRes.error){
    console.log("Erreur lecture dernière facture:", lastRes.error);
    alert("Erreur Supabase (lecture factures). Voir Console F12.");
    return;
  }

  let next = 1;
  if(lastRes.data && lastRes.data.length && lastRes.data[0].invoice_number){
    const last = String(lastRes.data[0].invoice_number).split("-").pop();
    const n = parseInt(last, 10);
    if(!isNaN(n)) next = n + 1;
  }

  const year = new Date().getFullYear();
  const invoice_number = `${year}-${String(next).padStart(4,"0")}`;

  const tva = ht * 0.081;
  const total = ht + tva;

  const insRes = await db().from("invoices").insert([{
    client_id,
    invoice_number,
    tva,
    total
  }]);

  if(insRes.error){
    console.log("Erreur création facture:", insRes.error);
    alert("Facture NON créée (voir Console F12).");
    return;
  }

  $("i_total").value = "";
  await refreshAll();
  alert("Facture " + invoice_number + " créée ✅");
}

async function loadInvoices(){
  const res = await db()
    .from("invoices")
    .select("invoice_number,total,tva,created_at,client_id")
    .order("created_at",{ascending:false});

  if(res.error){
    console.log("loadInvoices error:", res.error);
    alert("Erreur factures (voir Console F12)");
    return;
  }

  const invoices = res.data || [];

  // Charger les clients une fois
  const cl = await db().from("clients").select("id,company,last_name");
  const map = new Map((cl.data||[]).map(c => [c.id, (c.company || c.last_name || "")]));

  const tbody = document.getElementById("tblInvoices");
  tbody.innerHTML = "";

  invoices.forEach(i=>{
    const d = new Date(i.created_at);
    const client = map.get(i.client_id) || "";
    tbody.innerHTML += `<tr>
      <td>${i.invoice_number||""}</td>
      <td>${d.toLocaleDateString("fr-CH")}</td>
      <td>${client}</td>
      <td>${Number(i.total||0).toFixed(2)} CHF</td>
      <td><button onclick="generatePDF('${i.invoice_number}')">PDF</button></td>
    </tr>`;
  });
}

// ========= QR-FACTURE (SPC) + PDF =========
// Mets TON IBAN ici (obligatoire)
const QR_CREDITOR = {
  iban: "CH773000520427805601Y",          // <-- REMPLACE
  name: "Brimot Nettoyage",
  street: "Impasse des Griottes",
  building: "3",
  postal: "1462",
  city: "Yvonand",
  country: "CH",
};

function buildSwissQRPayload({ invoice_number, amountCHF, message }) {
  const amt = Number(amountCHF||0).toFixed(2);
  const L = [
    "SPC","0200","1",
    QR_CREDITOR.iban,
    "S",
    QR_CREDITOR.name,
    QR_CREDITOR.street,
    QR_CREDITOR.building,
    QR_CREDITOR.postal,
    QR_CREDITOR.city,
    QR_CREDITOR.country,
    "","","","","","","",
    amt,"CHF",
    "","","","","","","",
    "NON","",
    message || `Facture ${invoice_number}`,
    "EPD",
    "",
    "",
    ""
  ];
  return L.join("\n");
}

function qrToDataURL(text){
  return new Promise((resolve)=>{
    const tmp = document.createElement("div");
    tmp.style.position="fixed";
    tmp.style.left="-9999px";
    tmp.style.top="-9999px";
    document.body.appendChild(tmp);

    new QRCode(tmp, { text, width:240, height:240, correctLevel:QRCode.CorrectLevel.M });

    setTimeout(()=>{
      const img = tmp.querySelector("img");
      if(img && img.src) resolve(img.src);
      else{
        const canvas = tmp.querySelector("canvas");
        resolve(canvas ? canvas.toDataURL("image/png") : null);
      }
      tmp.remove();
    }, 80);
  });
}

async function generatePDF(invoice_number){
  const { data, error } = await db()
    .from("invoices")
    .select("invoice_number,total,tva,created_at, clients(company,last_name)")
    .eq("invoice_number", invoice_number)
    .single();

  if(error || !data) return alert("Impossible de charger la facture");

  const inv = data;
  const clientName = inv.clients?.company || inv.clients?.last_name || "";
  const ttc = Number(inv.total||0);
  const tva = Number(inv.tva||0);
  const ht = ttc - tva;

  const payload = buildSwissQRPayload({
    invoice_number: inv.invoice_number,
    amountCHF: ttc,
    message: `Facture ${inv.invoice_number} - ${clientName}`,
  });

  const qrDataUrl = await qrToDataURL(payload);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("SwissBill", 20, 20);
  doc.setFontSize(12);

  doc.text(`Facture : ${inv.invoice_number}`, 20, 40);
  doc.text(`Date : ${new Date(inv.created_at).toLocaleDateString("fr-CH")}`, 20, 48);
  doc.text(`Client : ${clientName}`, 20, 56);

  doc.text(`Total HT : ${ht.toFixed(2)} CHF`, 20, 74);
  doc.text(`TVA 8.1% : ${tva.toFixed(2)} CHF`, 20, 82);
  doc.text(`Total TTC : ${ttc.toFixed(2)} CHF`, 20, 90);

  doc.text("QR-facture (paiement)", 20, 115);
  if(qrDataUrl) doc.addImage(qrDataUrl, "PNG", 20, 125, 60, 60);

  doc.save(`facture_${inv.invoice_number}.pdf`);
}

// ========= boot =========
document.addEventListener("DOMContentLoaded", async ()=>{
  document.querySelectorAll(".nav").forEach(b=>{
    b.addEventListener("click", ()=> show(b.dataset.page));
  });

  $("btnAddClient").addEventListener("click", addClient);
  $("btnAddProduct").addEventListener("click", addProduct);
  $("btnAddInvoice").addEventListener("click", addInvoice);

  show("dashboard");
  await refreshAll();
});
function addInvoiceRow(){

const tbody = document.querySelector("#invoiceItems tbody")

let row = document.createElement("tr")

row.innerHTML = `

<td><input class="prod"></td>

<td><input class="qty" type="number" value="1"></td>

<td>
<select class="unit">
<option>h</option>
<option>m2</option>
<option>m3</option>
<option>kg</option>
<option>pièce</option>
<option>forfait</option>
<option>km</option>
</select>
</td>

<td><input class="price" type="number"></td>

<td class="total">0</td>

`

tbody.appendChild(row)

row.querySelectorAll(".qty,.price").forEach(el=>{

el.addEventListener("input",()=>{

const qty = row.querySelector(".qty").value
const price = row.querySelector(".price").value

row.querySelector(".total").textContent =
(qty*price).toFixed(2)

})

})

}
function addInvoiceRow(){

const tbody = document.querySelector("#invoiceItems tbody")

if(!tbody) return

let row = document.createElement("tr")

row.innerHTML = `
<td><input class="prod"></td>

<td><input class="qty" type="number" value="1"></td>

<td>
<select class="unit">
<option>h</option>
<option>m2</option>
<option>m3</option>
<option>kg</option>
<option>pièce</option>
<option>forfait</option>
<option>km</option>
</select>
</td>

<td><input class="price" type="number"></td>

<td class="total">0</td>
`

tbody.appendChild(row)

}
