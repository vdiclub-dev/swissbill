function selectClient(id,name,address){

document.getElementById("clientSearch").value = name

document.getElementById("clientResults").innerHTML=""

window.selectedClient = id

// remplir adresse enlèvement
document.getElementById("pickup_address").value = address

}
console.log("clients.js chargé")

const sb = window.supabaseClient

async function searchClient(){

const term =
document.getElementById("clientSearch").value

if(term.length < 2){
document.getElementById("clientResults").innerHTML=""
return
}

const {data,error} = await sb
.from("clients")
.select("*")
.ilike("nom","%"+term+"%")
.limit(10)

if(error){
console.error(error)
return
}

const results =
document.getElementById("clientResults")

results.innerHTML=""

data.forEach(c=>{

results.innerHTML += `
<div class="client-item"
onclick="selectClient('${c.nom}','${c.adresse}','${c.ville}')">

<strong>${c.nom}</strong><br>
${c.adresse} ${c.ville}

</div>
`

})

}

function selectClient(nom,adresse,ville){

document.getElementById("clientSearch").value = nom

document.getElementById("pickup_address").value =
adresse + ", " + ville

document.getElementById("clientResults").innerHTML=""

}

window.searchClient = searchClient
window.selectClient = selectClient
