console.log("dispatch chargé")

async function startDispatch(){

await loadDispatchStats()
await loadOrdersMap()
await loadDrivers()
await loadOrdersList()

}

startDispatch()

const pickupGeo = await geocodeCity(order.pickup_city)

if(pickupGeo){


async function optimizeTourAI(orders){

const cities = orders.map(o=>o.delivery_city)

const response = await fetch("/api/ai-dispatch",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
start:"Yverdon",
destinations:cities
})
})

const result = await response.json()

return result.order

}


const data = await response.json()

return data.choices[0].message.content

}
/* ---------------------- */
/* CARTE */
/* ---------------------- */

const map = L.map("map").setView([46.52, 6.63], 9)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18
}).addTo(map)

const markers = L.markerClusterGroup()
map.addLayer(markers)

let routeLine = null
const geoCache = {}

/* couleurs tournées */
const tourColors = ["red", "blue", "green", "orange", "purple"]

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

window.openModal = function (title, content) {
  document.getElementById("modal-title").innerText = title
  document.getElementById("modal-content").innerHTML = content
  document.getElementById("modal").style.display = "flex"
}

window.closeModal = function () {
  document.getElementById("modal").style.display = "none"
}

/* ---------------------- */
/* CRÉER TRANSPORT */
/* ---------------------- */
window.newTransport = function(){

openModal(
"Créer transport",
`

<label>Client</label>
<input id="client" placeholder="Nom client">

<label>Ramassage (Pickup)</label>
<input id="pickup_city" placeholder="Ville pickup">

<label>Livraison</label>
<input id="delivery_city" placeholder="Ville livraison">

<label>Priorité</label>
<select id="priority">
<option value="normal">Normal</option>
<option value="urgent">Urgent</option>
</select>

<label>Poids</label>
<input id="weight" type="number" value="1">

<br><br>

<button class="btn" onclick="createTransport()">
Créer transport
</button>

`
)

}

window.createTransport = async function(){

const client = document.getElementById("client").value
const pickup = document.getElementById("pickup_city").value
const delivery = document.getElementById("delivery_city").value
const priority = document.getElementById("priority").value
const weight = document.getElementById("weight").value

if(!pickup || !delivery){
alert("Pickup et livraison obligatoires")
return
}

const { error } = await supabase
.from("orders")
.insert([{

client_name:client,

pickup_city:pickup,
delivery_city:delivery,

priority:priority,
weight:weight,

status:"pending"

}])

if(error){

console.error(error)
alert("Erreur création transport")
return

}

alert("Transport créé")

closeModal()

loadOrdersMap()
loadOrdersList()

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

async function loadOrdersMap() {
  markers.clearLayers()

  const { data, error } = await supabase
    .from("orders")
    .select("*")

  if (error) {
    console.error(error)
    return
  }

  let tourIndex = 1
  const bounds = []

  for (const order of data) {
    const city = order.delivery_city
    if (!city) continue

    const geo = await geocodeCity(city)
    if (!geo) continue

    const lat = geo.lat
    const lng = geo.lng

    let marker

    if (order.status === "pending") {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pulse-marker"></div>`,
        iconSize: [20, 20]
      })

      marker = L.marker([lat, lng], { icon })
    } else {
      let color = "gray"

      if (order.tour_id) {
        const index = Math.abs(Number(order.tour_id)) % tourColors.length
        color = tourColors[index]
      } else if (order.status === "planned") {
        color = "orange"
      } else if (order.status === "urgent") {
        color = "red"
      } else if (order.status === "delivered") {
        color = "green"
      }

      const icon = L.divIcon({
        className: "route-number",
        html: `<div style="
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
        iconSize: [30, 30]
      })

      marker = L.marker([lat, lng], { icon })
      tourIndex++
    }

   marker.bindPopup(`
📦 ${order.client_name}<br>
${order.address}<br>
${order.delivery_city}<br><br>

<button onclick="openRoute('${order.delivery_city}')">
Navigation
</button>
`)

    markers.addLayer(marker)
    bounds.push([lat, lng])
  }

  await loadDrivers()

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] })
  }
}

/* ---------------------- */
/* LISTE TRANSPORTS */
/* ---------------------- */

async function loadOrdersList() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")

  if (error) {
    console.error(error)
    return
  }

  const list = document.getElementById("orders-list")
  if (!list) return

  list.innerHTML = ""

  const optimized = await optimizeTour(data)

  for (const order of optimized) {
    const item = document.createElement("div")
    item.className = "order-item"

    const route = await getRouteInfo(order.delivery_city)

    item.innerHTML = `
      📦 #${order.id}<br>
      ${order.delivery_city}<br>
      ${route || ""}
    `

    item.onclick = () => {
      focusTransport(order.delivery_city)
      drawRoute(order.delivery_city)
    }

    list.appendChild(item)
  }
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
