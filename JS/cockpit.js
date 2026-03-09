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
