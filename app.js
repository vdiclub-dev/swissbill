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
  const client_id = $("i_client").value;
  const total = Number(($("i_total").value||"0").replace(",", "."));
  if(!client_id) return alert("Choisis un client");
  if(!total) return alert("Montant invalide");

  await db().from("invoices").insert([{ client_id, total }]);
  $("i_total").value="";
  await refreshAll();
}

/* ---------- BOOT ---------- */
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
