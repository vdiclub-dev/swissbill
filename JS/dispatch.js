console.log("dispatch chargé")
window.onclick = function(event){

const modal = document.getElementById("modal")

if(event.target === modal){
modal.style.display = "none"
}

}
/* ---------------------- */
/* CARTE */
/* ---------------------- */

const map = L.map("map").setView([46.52, 6.63], 9)
const tourColors = ["red", "blue", "green", "orange", "purple"]
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
maxZoom:18
}).addTo(map)

const markers = L.markerClusterGroup()
map.addLayer(markers)

let routeLine = null
const geoCache = {}


/* couleurs tournées */


/* ---------------------- */
/* OUTILS */
/* ---------------------- */

async function geocodeCity(city) {
  if (!city) return null

  const key = city.trim().toLowerCase()
  if (geoCache[key]) return geoCache[key]

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`
  )

  const result = await response.json()
  if (!result.length) return null

  const point = {
    lat: parseFloat(result[0].lat),
    lng: parseFloat(result[0].lon)
  }

  geoCache[key] = point
  return point
}

/* ---------------------- */
/* STATS DISPATCH */
/* ---------------------- */

async function loadDispatchStats() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")

  if (error) {
    console.error(error)
    return
  }

  const pending = data.filter(o => o.status === "pending").length
  const planned = data.filter(o => o.status === "planned").length
  const delivered = data.filter(o => o.status === "delivered").length

  const statsBox = document.getElementById("dispatchStats")
  if (statsBox) {
    statsBox.innerHTML = `⚠️ ${pending} à planifier • 🗺 ${planned} tournées • ✅ ${delivered} livrés`
  }
}

/* ---------------------- */
/* GOOGLE MAPS */
/* ---------------------- */

function openRoute(city) {
  const origin = "Yverdon"
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(city)}&travelmode=driving`
  window.open(url, "_blank")
}

/* ---------------------- */
/* MODAL */
/* ---------------------- */

window.openModal = function(title,content){

const modal = document.getElementById("modal")

document.getElementById("modal-title").innerText = title
document.getElementById("modal-content").innerHTML = content

modal.style.display = "flex"

}

window.newTransport = function(){

openModal(
"Créer transport",
`

<h3>Client</h3>

<label>Nom client</label>
<input id="client">

<label>Téléphone</label>
<input id="phone">


<h3>Ramassage</h3>

<label>Rue</label>
<input id="pickup_street">

<label>N°</label>
<input id="pickup_number">

<label>Code postal</label>
<input id="pickup_postal">

<label>Ville</label>
<input id="pickup_city">


<h3>Livraison</h3>

<label>Rue</label>
<input id="delivery_street">

<label>N°</label>
<input id="delivery_number">

<label>Code postal</label>
<input id="delivery_postal">

<label>Ville</label>
<input id="delivery_city">


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

<br><br>

<button class="btn" onclick="createTransport()">
Créer transport
</button>

`
)

}
window.createTransport = async function(){

const client = document.getElementById("client").value
const phone = document.getElementById("phone").value

const pickupStreet = document.getElementById("pickup_street").value
const pickupNumber = document.getElementById("pickup_number").value
const pickupPostal = document.getElementById("pickup_postal").value
const pickupCity = document.getElementById("pickup_city").value

const deliveryStreet = document.getElementById("delivery_street").value
const deliveryNumber = document.getElementById("delivery_number").value
const deliveryPostal = document.getElementById("delivery_postal").value
const deliveryCity = document.getElementById("delivery_city").value

const weight = document.getElementById("weight").value
const priority = document.getElementById("priority").value
const note = document.getElementById("note").value

if(!pickupCity || !deliveryCity){
alert("Ville pickup et livraison obligatoires")
return
}

const { error } = await supabase
.from("orders")
.insert([{

client_name:client,
phone:phone,

pickup_street:pickupStreet,
pickup_number:pickupNumber,
pickup_postal:pickupPostal,
pickup_city:pickupCity,

delivery_street:deliveryStreet,
delivery_number:deliveryNumber,
delivery_postal:deliveryPostal,
delivery_city:deliveryCity,

priority:priority,
weight:weight,
note:note,

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
/* ---------------------- */
/* TOURNÉE */
/* ---------------------- */

async function optimizeTour(orders) {
  const startCity = "Yverdon"
  const start = await geocodeCity(startCity)

  if (!start) return orders

  let remaining = [...orders]
  let route = []
  let current = start

  while (remaining.length) {
    let bestIndex = -1
    let bestDistance = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const geo = await geocodeCity(remaining[i].delivery_city)
      if (!geo) continue

      const routeReq = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${current.lng},${current.lat};${geo.lng},${geo.lat}?overview=false`
      )

      const data = await routeReq.json()
      if (!data.routes || !data.routes.length) continue

      const distance = data.routes[0].distance

      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
        remaining[i]._geo = geo
      }
    }

    if (bestIndex === -1) break

    const next = remaining.splice(bestIndex, 1)[0]
    route.push(next)
    current = next._geo
  }

  return route
}

async function generateTour() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending")

  if (error) {
    console.error(error)
    return
  }

  if (!data.length) {
    alert("Aucun transport à planifier")
    return
  }

  const optimized = await optimizeTour(data)
  const tourId = Date.now()

  for (const order of optimized) {
    await supabase
      .from("orders")
      .update({
        status: "planned",
        tour_id: tourId
      })
      .eq("id", order.id)
  }

  alert("Tournée créée")
  await refreshDispatch()
}

window.generateTour = generateTour

async function drawTour(tourId) {
  if (!tourId) return

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tour_id", tourId)

  if (error) {
    console.error(error)
    return
  }

  const points = []

  for (const order of data) {
    const geo = await geocodeCity(order.delivery_city)
    if (!geo) continue
    points.push([geo.lat, geo.lng])
  }

  if (points.length < 2) return

  if (routeLine) {
    map.removeLayer(routeLine)
  }

  routeLine = L.polyline(points, {
    color: "red",
    weight: 4,
    opacity: 0.8
  }).addTo(map)

  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] })
}

window.drawTour = drawTour

/* ---------------------- */
/* CHAUFFEURS */
/* ---------------------- */

async function loadDrivers() {
  const { data, error } = await supabase
    .from("drivers")
    .select("*")

  if (error) {
    console.error(error)
    return
  }

  data.forEach(driver => {
    if (driver.lat == null || driver.lng == null) return

    const marker = L.circleMarker([driver.lat, driver.lng], {
      radius: 8,
      color: "green",
      fillColor: "green",
      fillOpacity: 0.9
    })

    marker.bindPopup(`🚚 Chauffeur : ${driver.name}`)
    markers.addLayer(marker)
  })
}

/* ---------------------- */
/* CARTE TRANSPORTS */
/* ---------------------- */

async function loadOrdersMap(){

markers.clearLayers()

const { data, error } = await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

let tourIndex = 1
const bounds = []

for(const order of data){

/* ---------------------- */
/* PICKUP */
/* ---------------------- */

if(order.pickup_city){
const address =
`${order.delivery_street} ${order.delivery_number} ${order.delivery_postal} ${order.delivery_city}`
  const geo = await geocodeCity(address)
const pickupGeo = await geocodeCity(order.pickup_city)

if(pickupGeo){

const pickupMarker = L.circleMarker(
[pickupGeo.lat,pickupGeo.lng],
{
radius:7,
color:"blue",
fillColor:"blue",
fillOpacity:0.9
})

pickupMarker.bindPopup(`
📦 Pickup<br>
${order.client_name}<br>
${order.pickup_city}
`)

markers.addLayer(pickupMarker)
bounds.push([pickupGeo.lat,pickupGeo.lng])

}

}

/* ---------------------- */
/* DELIVERY */
/* ---------------------- */

if(order.delivery_city){

const deliveryGeo = await geocodeCity(order.delivery_city)

if(!deliveryGeo) continue

const lat = deliveryGeo.lat
const lng = deliveryGeo.lng

let marker

/* transport en attente */

if(order.status === "pending"){

const icon = L.divIcon({
className:"",
html:`<div class="pulse-marker"></div>`,
iconSize:[20,20]
})

marker = L.marker([lat,lng],{icon})

}

/* transport planifié */

else{

let color = "gray"

if(order.tour_id){

const index = Math.abs(Number(order.tour_id)) % tourColors.length
color = tourColors[index]

}

else if(order.status === "planned") color = "orange"
else if(order.status === "urgent") color = "red"
else if(order.status === "delivered") color = "green"

const icon = L.divIcon({
className:"route-number",
html:`<div style="
background:${color};
width:28px;
height:28px;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
font-weight:bold;
border:2px solid white;
color:white;
">${tourIndex}</div>`,
iconSize:[30,30]
})

marker = L.marker([lat,lng],{icon})
tourIndex++

}

marker.bindPopup(`
📦 ${order.client_name || "Client"}<br>
🔵 Pickup : ${order.pickup_address || ""} ${order.pickup_city || ""}<br>
🔴 Delivery : ${order.delivery_address || ""} ${order.delivery_city || ""}<br>
☎️ ${order.contact_phone || "-"}<br>
⚡ ${order.priority || "normal"} • ${order.weight || 0} kg<br>
📝 ${order.note || "-"}<br><br>

<button onclick="openRoute('${order.delivery_city}')">
Navigation
</button>
`)

markers.addLayer(marker)
bounds.push([lat,lng])

}

}

/* ---------------------- */
/* CHAUFFEURS */
/* ---------------------- */

await loadDrivers()

/* ---------------------- */
/* ZOOM AUTO */
/* ---------------------- */

if(bounds.length > 0){

map.fitBounds(bounds,{padding:[50,50]})

}

}
/* ---------------------- */
/* LISTE TRANSPORTS */
/* ---------------------- */

async function loadOrdersList(){

const { data, error } = await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

const list = document.getElementById("orders-list")
if(!list) return

/* tableau */

let html = `
<table class="dispatch-table">

<thead>
<tr>
<th>ID</th>
<th>Client</th>
<th>Pickup</th>
<th>Delivery</th>
<th>Priorité</th>
<th>Poids</th>
<th></th>
</tr>
</thead>

<tbody>
`

for(const order of data){

html += `
<tr>

<td>#${order.id}</td>

<td>
${order.client_name || ""}
</td>

<td>
${order.pickup_street || ""} ${order.pickup_number || ""}<br>
${order.pickup_postal || ""} ${order.pickup_city || ""}
</td>

<td>
${order.delivery_street || ""} ${order.delivery_number || ""}<br>
${order.delivery_postal || ""} ${order.delivery_city || ""}
</td>

<td>${order.priority || ""}</td>

<td>${order.weight || ""} kg</td>

<td>
<button onclick="focusTransport('${order.delivery_city}')">
Carte
</button>
</td>

</tr>
`
}

html += `
</tbody>
</table>
`

list.innerHTML = html

}

/* ---------------------- */
/* CENTRER / ROUTE */
/* ---------------------- */

async function focusTransport(city) {
  const point = await geocodeCity(city)
  if (!point) return

  map.setView([point.lat, point.lng], 12)
}

window.focusTransport = focusTransport

async function getRouteInfo(city) {
  const origin = "Yverdon"

  const p1 = await geocodeCity(origin)
  const p2 = await geocodeCity(city)

  if (!p1 || !p2) return null

  const route = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=false`
  )

  const data = await route.json()
  if (!data.routes || !data.routes.length) return null

  const km = (data.routes[0].distance / 1000).toFixed(1)
  const min = Math.round(data.routes[0].duration / 60)

  return `${km} km • ${min} min`
}

async function drawRoute(city) {
  const origin = "Yverdon"

  const p1 = await geocodeCity(origin)
  const p2 = await geocodeCity(city)

  if (!p1 || !p2) return

  const route = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`
  )

  const data = await route.json()
  if (!data.routes || !data.routes.length) return

  const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])

  if (routeLine) {
    map.removeLayer(routeLine)
  }

  routeLine = L.polyline(coords, {
    color: "blue",
    weight: 4
  }).addTo(map)

  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] })

  const km = (data.routes[0].distance / 1000).toFixed(1)
  const min = Math.round(data.routes[0].duration / 60)

  const routeInfo = document.getElementById("routeInfo")
  if (routeInfo) {
    routeInfo.innerHTML = `🚚 ${km} km • ${min} min`
  }
}

window.drawRoute = drawRoute
window.openRoute = openRoute

/* ---------------------- */
/* RAFRAICHISSEMENT */
/* ---------------------- */

async function refreshDispatch() {
  await loadDispatchStats()
  await loadOrdersMap()
  await loadOrdersList()
}

/* ---------------------- */
/* DEMARRAGE */
/* ---------------------- */

async function startDispatch(){

await loadDispatchStats()
await loadOrdersMap()
await loadDrivers()
await loadOrdersList()

}


startDispatch()
setInterval(()=>{

loadOrdersMap()

},10000)
