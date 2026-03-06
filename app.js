function showPage(page){

document.querySelectorAll(".page").forEach(p=>{
p.style.display="none"
})

document.getElementById(page).style.display="block"

}

document.addEventListener("DOMContentLoaded", ()=>{
showPage("dashboard")
loadClients()
})

async function addClient(){

const company = document.getElementById("c_company").value
const last_name = document.getElementById("c_lastname").value
const email = document.getElementById("c_email").value

await window.supabaseClient
.from("clients")
.insert([{company,last_name,email}])

loadClients()

}

async function loadClients(){

const {data} = await window.supabaseClient
.from("clients")
.select("*")

const table = document.getElementById("clientsTable")
table.innerHTML=""

data.forEach(c=>{

table.innerHTML+=`
<tr>
<td>${c.company}</td>
<td>${c.last_name}</td>
<td>${c.email}</td>
</tr>
`

})

}

async function addProduct(){

const name = document.getElementById("p_name").value
const price = document.getElementById("p_price").value

await window.supabaseClient
.from("products")
.insert([{name,price}])

alert("Produit ajouté")

}
