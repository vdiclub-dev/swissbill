function showPage(page){

document.querySelectorAll(".page").forEach(p=>{
p.style.display="none"
})

document.getElementById(page).style.display="block"

}

showPage("dashboard")

// ====================
// CLIENTS
// ====================

async function loadClients(){

const {data,error} = await window.supabaseClient
.from("clients")
.select("*")

if(error){
console.log(error)
return
}

const table = document.getElementById("clientsTable")
table.innerHTML=""

data.forEach(c=>{

table.innerHTML += `
<tr>
<td>${c.company||""}</td>
<td>${c.last_name||""}</td>
<td>${c.email||""}</td>
</tr>
`

})

}

async function addClient(){

const company=document.getElementById("company").value
const last=document.getElementById("lastname").value
const email=document.getElementById("email").value

const {error}=await window.supabaseClient
.from("clients")
.insert([{company,last_name:last,email}])

if(error){
console.log(error)
alert("Erreur client")
return
}

loadClients()

}

// ====================
// PRODUITS
// ====================

async function addProduct(){

const name=document.getElementById("productName").value
const price=document.getElementById("productPrice").value

await window.supabaseClient
.from("products")
.insert([{name,price}])

alert("Produit ajouté")

}

// ====================
// FACTURES
// ====================

async function createInvoice(){

const client=document.getElementById("clientSelect").value
const amount=document.getElementById("amount").value

await window.supabaseClient
.from("invoices")
.insert([{client_id:client,total:amount}])

alert("Facture créée")

}

// ====================
// DASHBOARD
// ====================

async function loadDashboard(){

const inv=await window.supabaseClient
.from("invoices")
.select("total")

const cli=await window.supabaseClient
.from("clients")
.select("id")

const ca=inv.data.reduce((s,i)=>s+Number(i.total||0),0)

document.getElementById("kpi-ca").textContent=ca+" CHF"
document.getElementById("kpi-invoices").textContent=inv.data.length
document.getElementById("kpi-clients").textContent=cli.data.length

}

loadClients()
loadDashboard()
if(!client){
alert("Choisir un client")
return
}
async function loadClientSelect(){

const {data,error} = await window.supabaseClient
.from("clients")
.select("id,company,last_name")

if(error){
console.log(error)
return
}

const select=document.getElementById("clientSelect")
select.innerHTML=""

data.forEach(c=>{

const opt=document.createElement("option")

opt.value=c.id
opt.textContent=c.company || c.last_name

select.appendChild(opt)

})

}
loadClients()
loadClientSelect()
loadDashboard()
