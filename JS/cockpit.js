console.log("cockpit chargé")

let map

document.addEventListener("DOMContentLoaded",init)

function init(){

map = L.map("map").setView([46.8,6.6],8)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
).addTo(map)

loadDrivers()

}

async function loadDrivers(){

const {data} = await supabaseClient
.from("vehicles")
.select("*")

data.forEach(v=>{

L.marker([v.lat,v.lon])
.addTo(map)
.bindPopup("Chauffeur")

})

}
async function loadOrdersToday(){

const today = new Date().toISOString().split("T")[0]

const {data} = await supabaseClient
.from("orders")
.select("*")
.eq("date",today)

return data

}
function optimizeRoute(start,orders){

let route = []
let current = start

while(orders.length){

let nearest = orders[0]
let minDist = distance(current,nearest)

orders.forEach(o=>{

const d = distance(current,o)

if(d < minDist){

nearest = o
minDist = d

}

})

route.push(nearest)

current = nearest

orders = orders.filter(o=>o.id!==nearest.id)

}

return route

}
async function optimizeTodayRoute(){

const orders = await loadOrdersToday()

if(!orders || orders.length === 0){

alert("Aucun transport aujourd'hui")
return

}

// point de départ (Yvonand)
const start = {
lat:46.807,
lon:6.741
}

const optimized = optimizeRoute(start,orders)

drawOptimizedRoute(optimized)

}
function optimizeRoute(start,orders){

let route = []

let current = start

let remaining = [...orders]

while(remaining.length){

let nearest = remaining[0]

let minDist = getDistance(current,nearest)

remaining.forEach(o=>{

const d = getDistance(current,o)

if(d < minDist){

nearest = o
minDist = d

}

})

route.push(nearest)

current = nearest

remaining = remaining.filter(o=>o.id !== nearest.id)

}

return route

}
function getDistance(a,b){

const dx = a.lat - b.lat
const dy = a.lon - b.lon

return Math.sqrt(dx*dx + dy*dy)

}
function drawOptimizedRoute(route){

let latlngs = []

route.forEach(o=>{

latlngs.push([o.lat,o.lon])

})

L.polyline(latlngs,{
color:"blue",
weight:4
}).addTo(map)

map.fitBounds(latlngs)

}
