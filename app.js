function showPage(page){

document.querySelectorAll(".page").forEach(p=>{
p.style.display="none"
})

document.getElementById(page).style.display="block"

}

showPage("dashboard")

async function loadDashboard(){

let { data: invoices } = await supabaseClient
.from("invoices")
.select("*")

let { data: clients } = await supabaseClient
.from("clients")
.select("*")

let total=0

invoices.forEach(i=>{
total+=Number(i.total)
})

document.getElementById("ca").innerText=total+" CHF"
document.getElementById("invoiceCount").innerText=invoices.length
document.getElementById("clientCount").innerText=clients.length

}

async function loadClients(){

const { data } = await supabaseClient
.from("clients")
.select("*")

const table=document.querySelector("#clientsTable tbody")

table.innerHTML=""

data.forEach(c=>{

let row=`
<tr>
<td>${c.company||""}</td>
<td>${c.last_name||""}</td>
<td>${c.email||""}</td>
</tr>
`

table.innerHTML+=row

})

}

async function addClient(){

const company=document.getElementById("company").value
const lastname=document.getElementById("lastname").value
const email=document.getElementById("email").value

await supabaseClient
.from("clients")
.insert([{company,last_name:lastname,email}])

loadClients()
loadDashboard()

}

async function loadProducts(){

const { data } = await supabaseClient
.from("products")
.select("*")

const table=document.querySelector("#productsTable tbody")

table.innerHTML=""

data.forEach(p=>{

let row=`
<tr>
<td>${p.name}</td>
<td>${p.price} CHF</td>
</tr>
`

table.innerHTML+=row

})

}

async function addProduct(){

const name=document.getElementById("productName").value
const price=document.getElementById("productPrice").value

await supabaseClient
.from("products")
.insert([{name,price}])

loadProducts()

}

async function loadInvoices(){

const { data } = await supabaseClient
.from("invoices")
.select("*, clients(company,last_name)")

const table=document.querySelector("#invoiceTable tbody")

table.innerHTML=""

data.forEach(i=>{

let client=i.clients?.company||i.clients?.last_name||""

let row=`
<tr>
<td>${i.date}</td>
<td>${client}</td>
<td>${i.total} CHF</td>
</tr>
`

table.innerHTML+=row

})

}
async function createInvoice(){

const client = document.getElementById("clientSelect").value
const amount = Number(document.getElementById("amount").value)

let { data } = await supabaseClient
.from("invoices")
.select("invoice_number")
.order("invoice_number",{ascending:false})
.limit(1)

let nextNumber = 1

if(data && data.length>0){
nextNumber = parseInt(data[0].invoice_number)+1
}

const invoiceNumber = String(nextNumber).padStart(5,"0")

const tva = amount * 0.081
const total = amount + tva

await supabaseClient
.from("invoices")
.insert([{
invoice_number: invoiceNumber,
client_id: client,
total: total,
tva: tva,
date: new Date()
}])

alert("Facture "+invoiceNumber+" créée")

loadInvoices()
loadDashboard()

}

}

loadDashboard()
loadClients()
loadProducts()
loadInvoices()
loadClientSelect()
