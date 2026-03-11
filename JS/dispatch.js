console.log("dispatch chargé")
async function drawRoute(city){

  const origin = "Yverdon"

  const p1 = await geocodeCity(origin)
  const p2 = await geocodeCity(city)

  if(!p1 || !p2) return

  const route = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`
  )

  const data = await route.json()
  if(!data.routes || !data.routes.length) return

  const coords = data.routes[0].geometry.coordinates.map(c => [c[1],c[0]])

  if(routeLine){
    map.removeLayer(routeLine)
  }

  routeLine = L.polyline(coords,{
    color:"blue",
    weight:4
  }).addTo(map)

  map.fitBounds(routeLine.getBounds(),{padding:[40,40]})
}
async function focusTransport(city){
  const point = await geocodeCity(city)
  if(!point) return
  map.setView([point.lat, point.lng], 12)
}
async function loadDispatchStats(){

const { data } = await supabase
.from("orders")
.select("*")

const pending = data.filter(o=>o.status==="pending").length
const planned = data.filter(o=>o.status==="planned").length

document.getElementById("dispatchStats").innerHTML =
`⚠️ ${pending} à planifier • 🗺 ${planned} en tournée`

}
async function loadDispatchStats(){

const { data } = await supabase
.from("orders")
.select("*")

const pending = data.filter(o=>o.status==="pending").length
const planned = data.filter(o=>o.status==="planned").length

document.getElementById("dispatchStats").innerHTML =
`⚠️ ${pending} à planifier • 🗺 ${planned} en tournée`

}

async function drawTour(tourId){
routeLine = L.polyline(points,{
color:"red",
weight:4
}).addTo(map)
if(!tourId) return

const { data, error } = await supabase
.from("orders")
.select("*")
.eq("tour_id",tourId)

if(error){
console.error(error)
return
}

const points = []

for(const order of data){

const geo = await geocodeCity(order.delivery_city)

if(!geo) continue

points.push([geo.lat,geo.lng])

}

if(points.length < 2) return

L.polyline(points,{
color:"red",
weight:4,
opacity:0.8
}).addTo(map)

}

async function generateTour(){

const { data, error } = await supabase
.from("orders")
.select("*")
.eq("status","pending")

if(error){
console.error(error)
return
}

if(!data.length){
alert("Aucun transport à planifier")
return
}

/* optimisation */

const optimized = await optimizeTour(data)

/* numéro de tournée */

const tourId = Date.now()

for(const order of optimized){

await supabase
.from("orders")
.update({
status:"planned",
tour_id:tourId
})
.eq("id",order.id)

}

alert("Tournée créée")

loadOrdersMap()
loadOrdersList()

}

function groupByRegion(orders){

const regions = {
romandie:[],
suisse_centrale:[],
suisse_alemanique:[],
tessin:[]
}

orders.forEach(o=>{

const city = o.delivery_city.toLowerCase()

if(city.includes("genève") || city.includes("lausanne") || city.includes("nyon"))
regions.romandie.push(o)

else if(city.includes("berne"))
regions.suisse_centrale.push(o)

else if(city.includes("zurich") || city.includes("bâle"))
regions.suisse_alemanique.push(o)

else
regions.romandie.push(o)

})

return regions

}

async function optimizeTour(orders){

const startCity = "Yverdon"

const start = await geocodeCity(startCity)

let remaining = [...orders]
let route = []
let current = start

while(remaining.length){

let bestIndex = -1
let bestDistance = Infinity

for(let i=0;i<remaining.length;i++){

const geo = await geocodeCity(remaining[i].delivery_city)

if(!geo) continue

const routeReq = await fetch(
`https://router.project-osrm.org/route/v1/driving/${current.lng},${current.lat};${geo.lng},${geo.lat}?overview=false`
)

const data = await routeReq.json()

const distance = data.routes[0].distance

if(distance < bestDistance){
bestDistance = distance
bestIndex = i
remaining[i]._geo = geo
}

}

const next = remaining.splice(bestIndex,1)[0]

route.push(next)

current = next._geo

}

return route

}

/* ---------------------- */
/* CARTE */
/* ---------------------- */

const map = L.map("map").setView([46.52, 6.63], 9)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18
}).addTo(map)

/* groupe clusters pour transports + chauffeurs */
const markers = L.markerClusterGroup()
map.addLayer(markers)

/* couche itinéraire */
let routeLine = null

/* cache géocodage pour éviter trop d'appels */
const geoCache = {}

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
/* MODAL */
/* ---------------------- */

window.openModal = function (title, content) {
  document.getElementById("modal-title").innerText = title
  document.getElementById("modal-content").innerHTML = content
  document.getElementById("modal").style.display = "flex"
}

window.closeModal = function () {
  document.getElementById("modal").style.display = "none"
}

/* ---------------------- */
/* CREER TRANSPORT */
/* ---------------------- */

window.newTransport = function () {
  openModal(
    "Créer transport",
    `
    <label>Ville destination</label>
    <input id="dest" type="text" placeholder="Lausanne">

    <br><br>

    <button class="btn" onclick="createTransport()">Créer</button>
    `
  )
}

window.createTransport = async function () {
  const cityInput = document.getElementById("dest")

  if (!cityInput) {
    alert("Champ destination introuvable")
    return
  }

  const city = cityInput.value.trim()

  if (!city) {
    alert("Veuillez saisir une destination")
    return
  }

  const { error } = await supabase
    .from("orders")
    .insert([
      {
        delivery_city: city,
        pickup: "Yverdon",
        delivery: city,
        speed: "eco",
        weight: 1,
        status: "pending"
      }
    ])
let marker

if(order.status === "pending"){

const icon = L.divIcon({
className:"",
html:`<div class="pulse-marker"></div>`,
iconSize:[20,20]
})

marker = L.marker([lat,lng],{icon})

}else{

const icon = L.divIcon({
className:"route-number",
html:`<div style="
background:${color};
color:white;
width:28px;
height:28px;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
font-weight:bold;
border:2px solid white;
">${tourIndex}</div>`,
iconSize:[30,30]
})

marker = L.marker([lat,lng],{icon})

}
  if (error) {
    console.error(error)
    alert("Erreur création transport")
    return
  }

  alert("Transport créé")
  closeModal()

  await loadOrdersMap()
  await loadOrdersList()
}

/* ---------------------- */
/* AFFICHER TRANSPORTS CARTE */
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

const colors = [
"red",
"blue",
"green",
"orange",
"purple"
]

let tourIndex = 1
const bounds = []

for(const order of data){

const city = order.delivery_city
if(!city) continue

const geo = await geocodeCity(city)
if(!geo) continue

const lat = geo.lat
const lng = geo.lng

let marker

/* -------- TRANSPORT NON PLANIFIÉ -------- */

if(order.status === "pending"){

const icon = L.divIcon({
className:"",
html:`<div class="pulse-marker"></div>`,
iconSize:[20,20]
})

marker = L.marker([lat,lng],{icon})

}

/* -------- TRANSPORT PLANIFIÉ -------- */

else{

let color = "gray"

if(order.tour_id){
const index = order.tour_id % colors.length
color = colors[index]
}

const icon = L.divIcon({
className:"route-number",
html:`<div style="
background:${color};
color:white;
width:28px;
height:28px;
border-radius:50%;
display:flex;
align-items:center;
justify-content:center;
font-weight:bold;
border:2px solid white;
">${tourIndex}</div>`,
iconSize:[30,30]
})

marker = L.marker([lat,lng],{icon})

tourIndex++

}

/* -------- POPUP -------- */

marker.bindPopup(`
Transport #${order.id}<br>
Destination : ${order.delivery_city}<br>
Statut : ${order.status}
`)

markers.addLayer(marker)

bounds.push([lat,lng])

}

await loadDrivers()

if(bounds.length > 0){
map.fitBounds(bounds,{padding:[50,50]})
}

}

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

    marker.bindPopup(`
      🚚 Chauffeur : ${driver.name}
    `)

    markers.addLayer(marker)
  })
}

/* ---------------------- */
/* ASSIGNER CHAUFFEUR */
/* ---------------------- */

async function assignDriver(orderId) {
  const driver = prompt("ID du chauffeur")
  if (!driver) return

  const { error } = await supabase
    .from("orders")
    .update({ driver_id: driver })
    .eq("id", orderId)

  if (error) {
    console.error(error)
    alert("Erreur assignation")
    return
  }

  alert("Chauffeur assigné")
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
list.innerHTML = ""

/* optimisation tournée */

const optimized = await optimizeTour(data)

for(const order of optimized){

const item = document.createElement("div")

item.className = "order-item"

/* calcul distance et temps */

const route = await getRouteInfo(order.delivery_city)

item.innerHTML = `
📦 #${order.id}<br>
${order.delivery_city}<br>
${route || ""}
`

item.onclick = ()=>{

focusTransport(order.delivery_city)
drawRoute(order.delivery_city)

}

list.appendChild(item)

}

}

/* ---------------------- */
/* CENTRER CARTE */
/* ---------------------- */

async function focusTransport(city) {
  const point = await geocodeCity(city)
  if (!point) return

  map.setView([point.lat, point.lng], 12)
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
/* INFOS DISTANCE */
/* ---------------------- */

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

/* ---------------------- */
/* TRACER ITINERAIRE */
/* ---------------------- */

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
}

/* ---------------------- */
/* RAFRAICHISSEMENT AUTO */
/* ---------------------- */

async function refreshDispatch() {
  await loadOrdersMap()
  await loadOrdersList()
}

/* ---------------------- */
/* DEMARRAGE */
/* ---------------------- */
loadDispatchStats()
loadDispatchStats()
loadOrdersMap()
loadDrivers()
loadOrdersList()

setInterval(()=>{

loadOrdersMap()

},10000)
