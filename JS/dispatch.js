console.log("dispatch chargé")

async function calculateRoute(pickupCity,deliveryCity){

const p1 = await geocodeCity(pickupCity)
const p2 = await geocodeCity(deliveryCity)

if(!p1 || !p2) return null

const route = await fetch(
`https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=false`
)

const data = await route.json()

if(!data.routes || !data.routes.length) return null

return {

km: (data.routes[0].distance / 1000),
min: Math.round(data.routes[0].duration / 60)

}

}

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

window.newTransport = function(){

openModal(
"Créer transport",
`
<div class="dispatch-form">

  <div class="dispatch-form__section dispatch-form__section--compact">
    <div class="dispatch-form__grid dispatch-form__grid--2">
      <div class="dispatch-field">
        <label>Client</label>
        <input id="client" type="text" placeholder="Nom du client">
      </div>

      <div class="dispatch-field">
        <label>Téléphone</label>
        <input id="phone" type="text" placeholder="079 000 00 00">
      </div>
    </div>
  </div>

  <div class="dispatch-form__section">
    <div class="dispatch-form__section-title">Ramassage</div>

    <div class="dispatch-form__grid dispatch-form__grid--4">
      <div class="dispatch-field dispatch-field--span-2">
        <label>Rue</label>
        <input id="pickup_street" type="text" placeholder="Rue du pickup">
      </div>

      <div class="dispatch-field">
        <label>N°</label>
        <input id="pickup_number" type="text" placeholder="12">
      </div>

      <div class="dispatch-field">
        <label>Code postal</label>
        <input id="pickup_postal" type="text" placeholder="1000">
      </div>
    </div>

    <div class="dispatch-form__grid dispatch-form__grid--2">
      <div class="dispatch-field">
        <label>Ville</label>
        <input id="pickup_city" type="text" placeholder="Lausanne">
      </div>

      <div class="dispatch-field">
        <label>Référence pickup</label>
        <input id="pickup_note" type="text" placeholder="Quai, étage, sonnette…">
      </div>
    </div>
  </div>

  <div class="dispatch-form__section">
    <div class="dispatch-form__section-title">Livraison</div>

    <div class="dispatch-form__grid dispatch-form__grid--4">
      <div class="dispatch-field dispatch-field--span-2">
        <label>Rue</label>
        <input id="delivery_street" type="text" placeholder="Rue de livraison">
      </div>

      <div class="dispatch-field">
        <label>N°</label>
        <input id="delivery_number" type="text" placeholder="8">
      </div>

      <div class="dispatch-field">
        <label>Code postal</label>
        <input id="delivery_postal" type="text" placeholder="1200">
      </div>
    </div>

    <div class="dispatch-form__grid dispatch-form__grid--2">
      <div class="dispatch-field">
        <label>Ville</label>
        <input id="delivery_city" type="text" placeholder="Genève">
      </div>

      <div class="dispatch-field">
        <label>Référence livraison</label>
        <input id="delivery_note" type="text" placeholder="Service, réception, étage…">
      </div>
    </div>
  </div>

  <div class="dispatch-form__section dispatch-form__section--compact">
    <div class="dispatch-form__section-title">Colis</div>

    <div class="dispatch-form__grid dispatch-form__grid--3">
      <div class="dispatch-field">
        <label>Poids (kg)</label>
        <input id="weight" type="number" value="1" min="0" step="0.1">
      </div>

      <div class="dispatch-field">
        <label>Priorité</label>
        <select id="priority">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div class="dispatch-field">
        <label>Type</label>
        <select id="parcel_type">
          <option value="colis">Colis</option>
          <option value="document">Document</option>
          <option value="caisse">Caisse</option>
          <option value="palette">Palette</option>
        </select>
      </div>
    </div>

    <div class="dispatch-field">
      <label>Remarque générale</label>
      <textarea id="note" placeholder="Fragile, urgent avant 10h, remise contre signature…"></textarea>
    </div>
  </div>

  <div class="dispatch-form__actions">
    <button class="btn btn-secondary" type="button" onclick="closeModal()">Annuler</button>
    <button class="btn" type="button" onclick="createTransport()">Créer transport</button>
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
