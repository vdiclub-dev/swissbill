function selectClient(id,name,address){

document.getElementById("clientSearch").value = name

document.getElementById("clientResults").innerHTML=""

window.selectedClient = id

// remplir adresse enlèvement
document.getElementById("pickup_address").value = address

}
async function searchClient(){

const term = document.getElementById("clientSearch").value

if(term.length < 2){
document.getElementById("clientResults").innerHTML=""
return
}

const sb = window.supabaseClient

const {data,error} = await sb
.from("clients")
.select("id,company,first_name,last_name,address,city")
.or(`company.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
.limit(10)

if(error){
console.error(error)
return
}

const results = document.getElementById("clientResults")

results.innerHTML=""

data.forEach(c=>{

let name = c.company
? c.company
: (c.first_name||"") + " " + (c.last_name||"")

let address = (c.address||"") + " " + (c.city||"")

results.innerHTML += `
<div class="client-item"
onclick="selectClient('${c.id}','${name}','${address}')">
${name}
</div>
`

})

}
const sb = window.supabaseClient

async function loadClients(){

const {data} = await sb
.from("clients")
.select("*")
.order("nom")

const table = document.getElementById("clientsTable")

table.innerHTML=""

data.forEach(c=>{

table.innerHTML += `
<tr>

<td>${c.nom}</td>
<td>${c.entreprise||""}</td>
<td>${c.email||""}</td>
<td>${c.telephone||""}</td>

</tr>
`

})

}

const form = document.getElementById("clientForm")

if(form){

form.addEventListener("submit", async e => {

e.preventDefault()

const nom = document.getElementById("nom").value
const entreprise = document.getElementById("entreprise").value
const email = document.getElementById("email").value
const telephone = document.getElementById("telephone").value
const adresse = document.getElementById("adresse").value
const ville = document.getElementById("ville").value

await sb.from("clients").insert({
nom,
entreprise,
email,
telephone,
adresse,
ville
})

loadClients()

})

}

loadClients()
