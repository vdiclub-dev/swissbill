let map

function initMap(){

map = L.map('map').setView([46.8,7.2],8)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
maxZoom:19
}).addTo(map)

}

document.addEventListener("DOMContentLoaded", () => {

initMap()

})
async function sendParcel(){

const payload={

client:document.getElementById("client").value,
ville:document.getElementById("ville").value,
adresse:document.getElementById("adresse").value,

colis:Number(document.getElementById("colis").value),
poids:Number(document.getElementById("poids").value),

delai:document.getElementById("delai").value,
nuit:document.getElementById("nuit").value,
note:document.getElementById("note").value

}

const {error}=await db.from("colis").insert(payload)

if(error){

alert("Erreur : "+error.message)

}else{

alert("Demande envoyée")

}

}
async function loadColis(){

const {data,error}=await db
.from("colis")
.select("*")
.eq("statut","a_planifier")

if(error){

console.log(error)
return

}

data.forEach(c=>{

stops.push({
client:c.client,
ville:c.ville,
adresse:c.adresse,
colis:c.colis,
poids:c.poids
})

})

drawStops()
renderDashboard()

}
async function loadColis(){

const {data,error}=await db.from("colis").select("*")

if(error){

alert("Erreur chargement")

return

}

const table=document.getElementById("colisTable")

table.innerHTML=""

data.forEach(c=>{

table.innerHTML+=`
<tr>
<td>${c.client}</td>
<td>${c.ville}</td>
<td>${c.adresse}</td>
<td>${c.colis}</td>
<td>${c.poids}</td>
</tr>
`

})

}
