async function searchClient(){

const term =
document.getElementById("clientSearch").value

if(term.length < 2) return

const sb = window.supabaseClient

const {data} = await sb
.from("clients")
.select("*")
.ilike("nom","%"+term+"%")

const results =
document.getElementById("clientResults")

results.innerHTML=""

data.forEach(c=>{

results.innerHTML += `
<div onclick="selectClient('${c.id}','${c.nom}')">
${c.nom}
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
