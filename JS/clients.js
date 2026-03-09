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
.ilike("company","%"+term+"%")

if(error){
console.error(error)
return
}

let html = ""

data.forEach(c=>{

html += `
<div onclick="selectClient('${c.company}','${c.address}','${c.city}')">
<strong>${c.company}</strong><br>
${c.address} ${c.city}
</div>
`

})

document.getElementById("clientResults").innerHTML = html

}

function selectClient(name,address,city){

document.getElementById("clientSearch").value = name

document.getElementById("pickup_address").value =
address + ", " + city

document.getElementById("clientResults").innerHTML=""

}

window.searchClient = searchClient
window.selectClient = selectClient
