function selectClient(id,name){

document.getElementById("clientSearch").value = name

document.getElementById("clientResults").innerHTML=""

window.selectedClient = id

}
function selectClient(id,nom){

document.getElementById("clientSearch").value = nom

document.getElementById("clientResults").innerHTML=""

window.selectedClient = id

}
async function searchClient(){

const term =
document.getElementById("clientSearch").value

if(term.length < 2){
document.getElementById("clientResults").innerHTML=""
return
}

const sb = window.supabaseClient

const {data,error} = await sb
.from("clients")
.select("id,company,first_name,last_name")
.ilike("company","%"+term+"%")

if(error){
console.error(error)
return
}

const results =
document.getElementById("clientResults")

results.innerHTML=""

data.forEach(c=>{

let name = ""

if(c.company){
name = c.company
}else{
name = c.first_name + " " + c.last_name
}

results.innerHTML += `
<div onclick="selectClient('${c.id}','${name}')">
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

document
.getElementById("clientForm")
.addEventListener("submit",async e=>{

e.preventDefault()

await sb.from("clients").insert({

nom:nom.value,
entreprise:entreprise.value,
email:email.value,
telephone:telephone.value,
adresse:adresse.value,
ville:ville.value

})

loadClients()

})

loadClients()
