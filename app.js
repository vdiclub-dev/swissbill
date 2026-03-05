// =============================
// OUTILS
// =============================

function $(id){
  return document.getElementById(id);
}

function db(){
  return window.supabaseClient;
}

console.log("SwissBill démarré");


// =============================
// NAVIGATION
// =============================

function show(page){

  document.querySelectorAll(".page")
  .forEach(p=>p.classList.remove("active"))

  document.querySelectorAll(".nav")
  .forEach(b=>b.classList.remove("active"))

  const section = $("page-"+page)
  const btn = document.querySelector(`.nav[data-page="${page}"]`)

  if(section) section.classList.add("active")
  if(btn) btn.classList.add("active")

}


// =============================
// REFRESH GLOBAL
// =============================

async function refreshAll(){

  await Promise.allSettled([
    loadClients(),
    loadProducts(),
    loadInvoices(),
    loadInvoiceClientSelect(),
    loadDashboard()
  ])

}


// =============================
// DASHBOARD
// =============================

async function loadDashboard(){

  const invRes = await db().from("invoices").select("total")
  const cliRes = await db().from("clients").select("id")

  const inv = invRes.data || []
  const cli = cliRes.data || []

  const ca = inv.reduce((s,i)=> s + Number(i.total||0),0)

  $("kpi-ca").textContent = ca.toFixed(2)+" CHF"
  $("kpi-invoices").textContent = inv.length
  $("kpi-clients").textContent = cli.length

}


// =============================
// CLIENTS
// =============================

async function loadClients(){

  const {data} = await db()
  .from("clients")
  .select("*")
  .order("created_at",{ascending:false})

  const tbody = $("tblClients")
  tbody.innerHTML=""

  ;(data||[]).forEach(c=>{

    tbody.innerHTML += `
    <tr>
      <td>${c.company||""}</td>
      <td>${c.last_name||""}</td>
      <td>${c.email||""}</td>
    </tr>
    `

  })

}

async function addClient(){

  const company = $("c_company").value.trim()
  const last_name = $("c_lastname").value.trim()
  const email = $("c_email").value.trim()

  await db().from("clients").insert([
    {company,last_name,email}
  ])

  $("c_company").value=""
  $("c_lastname").value=""
  $("c_email").value=""

  

}


// =============================
// PRODUITS
// =============================

async function loadProducts(){

  const {data} = await db()
  .from("products")
  .select("*")
  .order("created_at",{ascending:false})

  const tbody = $("tblProducts")
  tbody.innerHTML=""

  ;(data||[]).forEach(p=>{

    tbody.innerHTML += `
    <tr>
      <td>${p.name}</td>
      <td>${Number(p.price||0).toFixed(2)} CHF</td>
    </tr>
    `

  })

}

async function addProduct(){

  const name = $("p_name").value.trim()
  const price = Number(($("p_price").value||"0").replace(",","."))

  await db().from("products").insert([
    {name,price}
  ])

  $("p_name").value=""
  $("p_price").value=""

  await refreshAll()

}


// =============================
// SELECT CLIENT FACTURE
// =============================

async function loadInvoiceClientSelect(){

  const {data} = await db()
  .from("clients")
  .select("id,company,last_name")
  .order("created_at",{ascending:false})

  const sel = $("i_client")

  sel.innerHTML=""

  ;(data||[]).forEach(c=>{

    const opt = document.createElement("option")

    opt.value = c.id
    opt.textContent = c.company || c.last_name

    sel.appendChild(opt)

  })

}


// =============================
// CREATION FACTURE
// =============================

async function addInvoice(){

  const client_id = $("i_client").value
  const ht = Number(($("i_total").value||"0").replace(",","."))

  const lastRes = await db()
  .from("invoices")
  .select("invoice_number")
  .order("created_at",{ascending:false})
  .limit(1)

  let next = 1

  if(lastRes.data && lastRes.data.length){

    const last = lastRes.data[0].invoice_number.split("-").pop()
    const n = parseInt(last,10)

    if(!isNaN(n)) next = n + 1

  }

  const year = new Date().getFullYear()

  const invoice_number =
  `${year}-${String(next).padStart(4,"0")}`

  const tva = ht * 0.081
  const total = ht + tva

  await db().from("invoices").insert([
    {client_id,invoice_number,tva,total}
  ])

  $("i_total").value=""

  await refreshAll()

}


// =============================
// LISTE FACTURES
// =============================

async function loadInvoices(){

  const res = await db()
  .from("invoices")
  .select("*")
  .order("created_at",{ascending:false})

  const invoices = res.data || []

  const cl = await db()
  .from("clients")
  .select("id,company,last_name")

  const map = new Map(
    (cl.data||[])
    .map(c=>[c.id,(c.company||c.last_name||"")])
  )

  const tbody = $("tblInvoices")

  tbody.innerHTML=""

  invoices.forEach(i=>{

    const d = new Date(i.created_at)

    tbody.innerHTML += `
    <tr>
      <td>${i.invoice_number}</td>
      <td>${d.toLocaleDateString("fr-CH")}</td>
      <td>${map.get(i.client_id)||""}</td>
      <td>${Number(i.total||0).toFixed(2)} CHF</td>
      <td>
      <button onclick="generatePDF('${i.invoice_number}')">
      PDF
      </button>
      </td>
    </tr>
    `

  })

}


// =============================
// BOOT
// =============================

document.addEventListener("DOMContentLoaded", async ()=>{

  if(!window.supabaseClient){

    alert("Supabase non chargé")
    return

  }

  document.querySelectorAll(".nav")
  .forEach(b=>{

    b.addEventListener(
      "click",
      ()=>show(b.dataset.page)
    )

  })

  $("btnAddClient").addEventListener("click",addClient)
  $("btnAddProduct").addEventListener("click",addProduct)
  $("btnAddInvoice").addEventListener("click",addInvoice)

  show("dashboard")

  await refreshAll()

})
