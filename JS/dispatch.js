console.log("dispatch chargé")

/* ------------------ */
/* CARTE */
/* ------------------ */

const map = L.map("map").setView([46.52,6.63],9)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{maxZoom:18}
).addTo(map)

const markers = L.markerClusterGroup()
map.addLayer(markers)

let routeLine=null

const geoCache={}

const tourColors=["red","blue","green","orange","purple"]

/* ------------------ */
/* GEOCODAGE */
/* ------------------ */

async function geocodeCity(city){

if(!city) return null

const key=city.toLowerCase()

if(geoCache[key]) return geoCache[key]

const r=await fetch(
`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`
)

const j=await r.json()

if(!j.length) return null

const p={
lat:parseFloat(j[0].lat),
lng:parseFloat(j[0].lon)
}

geoCache[key]=p

return p

}

/* ------------------ */
/* MODAL */
/* ------------------ */

window.openModal=function(title,content){

document.getElementById("modal-title").innerText=title
document.getElementById("modal-content").innerHTML=content
document.getElementById("modal").style.display="flex"

}

window.closeModal=function(){

document.getElementById("modal").style.display="none"

}

/* ------------------ */
/* CREER TRANSPORT */
/* ------------------ */

window.newTransport=function(){

openModal(
"Créer transport",

`
<div class="transport-form">

<div class="form-col">

<h3>Client</h3>

<label>Nom</label>
<input id="client">

<label>Téléphone</label>
<input id="phone">

</div>

<div class="form-row">

<div class="form-col">

<h3>Pickup</h3>

<label>Rue</label>
<input id="pickup_street">

<label>N°</label>
<input id="pickup_number">

<label>Code postal</label>
<input id="pickup_postal">

<label>Ville</label>
<input id="pickup_city">

</div>

<div class="form-col">

<h3>Livraison</h3>

<label>Rue</label>
<input id="delivery_street">

<label>N°</label>
<input id="delivery_number">

<label>Code postal</label>
<input id="delivery_postal">

<label>Ville</label>
<input id="delivery_city">

</div>

</div>

<div class="form-col">

<h3>Colis</h3>

<label>Poids</label>
<input id="weight" type="number" value="1">

<label>Priorité</label>

<select id="priority">
<option value="normal">Normal</option>
<option value="urgent">Urgent</option>
</select>

<label>Remarque</label>

<textarea id="note"></textarea>

</div>

<div class="form-actions">

<button class="btn" onclick="createTransport()">
Créer transport
</button>

</div>

</div>
`
)

}

window.createTransport=async function(){

const client=document.getElementById("client").value
const pickup=document.getElementById("pickup_city").value
const delivery=document.getElementById("delivery_city").value
const weight=document.getElementById("weight").value
const priority=document.getElementById("priority").value

if(!pickup||!delivery){
alert("Pickup et livraison obligatoires")
return
}

const {error}=await supabase
.from("orders")
.insert([{
client_name:client,
pickup_city:pickup,
delivery_city:delivery,
weight:weight,
priority:priority,
status:"pending"
}])

if(error){
console.error(error)
alert("Erreur création transport")
return
}

alert("Transport créé")

closeModal()

refreshDispatch()

}

/* ------------------ */
/* CARTE TRANSPORTS */
/* ------------------ */

async function loadOrdersMap(){

markers.clearLayers()

const {data,error}=await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

const bounds=[]

let index=1

for(const order of data){

const geo=await geocodeCity(order.delivery_city)

if(!geo) continue

let color="gray"

if(order.status==="pending") color="gray"
if(order.status==="planned") color="orange"
if(order.status==="urgent") color="red"
if(order.status==="delivered") color="green"

const icon=L.divIcon({
className:"route-number",
html:`<div style="
background:${color};
width:28px;
height:28px;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
color:white;
font-weight:bold
">${index}</div>`,
iconSize:[30,30]
})

const marker=L.marker([geo.lat,geo.lng],{icon})

marker.bindPopup(`
📦 ${order.client_name || ""}
<br>
${order.delivery_city}
<br><br>
<button onclick="openRoute('${order.delivery_city}')">
Navigation
</button>
`)

markers.addLayer(marker)

bounds.push([geo.lat,geo.lng])

index++

}

if(bounds.length) map.fitBounds(bounds,{padding:[50,50]})

}

/* ------------------ */
/* LISTE */
/* ------------------ */

async function loadOrdersList(){

const {data}=await supabase
.from("orders")
.select("*")

const list=document.getElementById("orders-list")

let html=""

for(const order of data){

html+=`
<div class="order-item">

<b>${order.client_name || ""}</b>
<br>

${order.pickup_city} → ${order.delivery_city}

</div>
`

}

list.innerHTML=html

}

/* ------------------ */
/* GOOGLE MAPS */
/* ------------------ */

function openRoute(city){

const url=`https://www.google.com/maps/dir/?api=1&origin=Yverdon&destination=${encodeURIComponent(city)}`

window.open(url,"_blank")

}

/* ------------------ */
/* IA */
/* ------------------ */

async function askDispatchAI(orders){

const payload=orders.map(o=>({
id:o.id,
city:o.delivery_city,
priority:o.priority
}))

const r=await fetch("/api/dispatch-ai",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
depot:"Yverdon",
orders:payload
})

})

return await r.json()

}

window.proposeAITours=async function(){

const {data}=await supabase
.from("orders")
.select("*")
.eq("status","pending")

if(!data.length){
alert("Aucun transport")
return
}

const ai=await askDispatchAI(data)

window.lastAIProposal=ai

openModal(
"Proposition IA",
`
<pre>${ai.summary}</pre>

<button onclick="applyAIProposal()">Appliquer</button>
`
)

}

async function applyAIProposal(){

if(!window.lastAIProposal) return

const tourId=Date.now()

for(const id of window.lastAIProposal.order){

await supabase
.from("orders")
.update({
status:"planned",
tour_id:tourId
})
.eq("id",id)

}

closeModal()

refreshDispatch()

}

/* ------------------ */
/* REFRESH */
/* ------------------ */

async function refreshDispatch(){

await loadOrdersMap()
await loadOrdersList()

}

/* ------------------ */
/* DEMARRAGE */
/* ------------------ */

async function startDispatch(){

await refreshDispatch()

}

startDispatch()

setInterval(()=>{

loadOrdersMap()

},10000)
