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

const client=document.getElementById("clientSelect").value
const amount=document.getElementById("amount").value

await supabaseClient
.from("invoices")
.insert([{client_id:client,total:amount,date:new Date()}])

loadInvoices()
loadDashboard()

}

async function loadClientSelect(){

const { data } = await supabaseClient
.from("clients")
.select("*")

const select=document.getElementById("clientSelect")

select.innerHTML=""

data.forEach(c=>{

let option=document.createElement("option")

option.value=c.id
option.text=c.company||c.last_name

select.appendChild(option)

})

}

loadDashboard()
loadClients()
loadProducts()
loadInvoices()
loadClientSelect()
