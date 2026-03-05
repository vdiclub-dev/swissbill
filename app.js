function $(id){
  return document.getElementById(id);
}

function db(){
  return window.supabaseClient;
}

console.log("SwissBill démarré");

function show(page){

  document.querySelectorAll(".page").forEach(p=>{
    p.style.display="none";
  });

  document.querySelectorAll(".nav").forEach(b=>{
    b.classList.remove("active");
  });

  const section = $("page-"+page);
  const btn = document.querySelector(`[data-page="${page}"]`);

  if(section) section.style.display="block";
  if(btn) btn.classList.add("active");

}

async function refreshAll(){

  await Promise.all([
    loadClients(),
    loadProducts(),
    loadInvoices(),
    loadInvoiceClientSelect(),
    loadDashboard()
  ]);

}

async function loadDashboard(){

  const inv = await db().from("invoices").select("total");
  const cli = await db().from("clients").select("id");

  const invoices = inv.data || [];
  const clients = cli.data || [];

  const ca = invoices.reduce((s,i)=> s + Number(i.total||0),0);

  $("kpi-ca").textContent = ca.toFixed(2)+" CHF";
  $("kpi-invoices").textContent = invoices.length;
  $("kpi-clients").textContent = clients.length;

}

async function loadClients(){

  const {data} = await db().from("clients").select("*");

  const tbody = $("tblClients");
  tbody.innerHTML="";

  (data||[]).forEach(c=>{
    tbody.innerHTML += `
      <tr>
        <td>${c.company||""}</td>
        <td>${c.last_name||""}</td>
        <td>${c.email||""}</td>
      </tr>`;
  });

}

async function addClient(){

  const company = $("c_company").value;
  const last_name = $("c_lastname").value;
  const email = $("c_email").value;

  await db().from("clients").insert([{company,last_name,email}]);

  $("c_company").value="";
  $("c_lastname").value="";
  $("c_email").value="";

  refreshAll();

}

async function loadProducts(){

  const {data} = await db().from("products").select("*");

  const tbody = $("tblProducts");
  tbody.innerHTML="";

  (data||[]).forEach(p=>{
    tbody.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${Number(p.price||0).toFixed(2)} CHF</td>
      </tr>`;
  });

}

async function addProduct(){

  const name = $("p_name").value;
  const price = Number($("p_price").value||0);

  await db().from("products").insert([{name,price}]);

  $("p_name").value="";
  $("p_price").value="";

  refreshAll();

}

async function loadInvoiceClientSelect(){

  const {data} = await db().from("clients").select("id,company,last_name");

  const sel = $("i_client");
  sel.innerHTML="";

  (data||[]).forEach(c=>{

    const opt=document.createElement("option");
    opt.value=c.id;
    opt.textContent=c.company || c.last_name;

    sel.appendChild(opt);

  });

}

async function addInvoice(){

  const client_id = $("i_client").value;
  const ht = Number($("i_total").value||0);

  const tva = ht * 0.081;
  const total = ht + tva;

  const year = new Date().getFullYear();

  const last = await db()
  .from("invoices")
  .select("invoice_number")
  .order("created_at",{ascending:false})
  .limit(1);

  let next=1;

  if(last.data && last.data.length){

    const n = last.data[0].invoice_number.split("-").pop();
    next = parseInt(n)+1;

  }

  const invoice_number = `${year}-${String(next).padStart(4,"0")}`;

  await db().from("invoices").insert([
    {client_id,invoice_number,tva,total}
  ]);

  refreshAll();

}

async function loadInvoices(){

  const {data} = await db()
  .from("invoices")
  .select("invoice_number,total,created_at,client_id");

  const cl = await db().from("clients").select("id,company,last_name");

  const map = new Map(
    (cl.data||[]).map(c=>[c.id,c.company||c.last_name])
  );

  const tbody = $("tblInvoices");
  tbody.innerHTML="";

  (data||[]).forEach(i=>{

    const d = new Date(i.created_at);

    tbody.innerHTML += `
    <tr>
      <td>${i.invoice_number}</td>
      <td>${d.toLocaleDateString("fr-CH")}</td>
      <td>${map.get(i.client_id)||""}</td>
      <td>${Number(i.total).toFixed(2)} CHF</td>
      <td><button onclick="generatePDF('${i.invoice_number}')">PDF</button></td>
    </tr>`;

  });

}

document.addEventListener("DOMContentLoaded", async ()=>{

  document.querySelectorAll(".nav").forEach(b=>{
    b.addEventListener("click",()=>show(b.dataset.page));
  });

  $("btnAddClient").onclick = addClient;
  $("btnAddProduct").onclick = addProduct;
  $("btnAddInvoice").onclick = addInvoice;

  show("dashboard");

  await refreshAll();

});
