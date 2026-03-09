async function scanParcel(code){

const {data} = await supabaseClient
.from("orders")
.select("*")
.eq("order_number",code)
.single()

if(!data){

alert("Colis inconnu")
return

}

await supabaseClient
.from("orders")
.update({

status:"loaded",
loaded_at:new Date()

})
.eq("id",data.id)

alert("Colis chargé")

}
async function setStatus(status){

await supabaseClient
.from("drivers")
.update({status:status})
.eq("id",driverId)

}
supabaseClient
.channel("drivers")

.on(
"postgres_changes",
{ event:"UPDATE",schema:"public",table:"drivers" },

payload=>{

updateDriverMarker(payload.new)

}

)

.subscribe()
async function loadDrivers(){

const {data} = await supabaseClient
.from("drivers")
.select("*")

data.forEach(d=>{

const marker = L.marker([d.lat,d.lon])
.addTo(map)

marker.bindPopup(
"🚚 "+d.name+"<br>"+d.status
)

})

}
navigator.geolocation.watchPosition(async pos=>{

const lat = pos.coords.latitude
const lon = pos.coords.longitude

await supabaseClient
.from("drivers")
.update({

lat:lat,
lon:lon,
updated_at:new Date()

})
.eq("id",driverId)

})
function navigate(address){

window.open(
"https://www.google.com/maps/dir/?api=1&destination="+
encodeURIComponent(address)
)

}
function displayRoute(route){

const div = document.getElementById("driverOrders")

div.innerHTML=""

route.forEach(r=>{

div.innerHTML +=
`
<div class="stop">

<b>${r.stop_order}</b>

${r.orders.delivery_address}

<button onclick="navigate('${r.orders.delivery_address}')">
Naviguer
</button>

</div>
`

})

}
async function loadDriverOrders(){

const driverId = "DRIVER_ID"

const {data} = await supabaseClient
.from("driver_routes")
.select(`
stop_order,
orders(*)
`)
.eq("driver_id",driverId)
.order("stop_order")

displayRoute(data)

}
async function updateStatus(id,status){

await supabaseClient
.from("orders")
.update({status:status})
.eq("id",id)

}
navigator.geolocation.watchPosition(pos=>{

const lat = pos.coords.latitude
const lon = pos.coords.longitude

supabaseClient
.from("vehicles")
.update({
lat:lat,
lon:lon,
updated_at:new Date()
})
.eq("driver_id",driverId)

})
async function startPause(){

await supabaseClient
.from("driver_logs")
.insert({

driver_id:driverId,
type:"pause",
time:new Date()

})

}
console.log("driver chargé")

let map

document.addEventListener("DOMContentLoaded",init)

function init(){

map = L.map("map").setView([46.8,6.6],8)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
).addTo(map)

loadDriverOrders()

}
function startScanner(){

const scanner = new Html5Qrcode("qr-reader")

scanner.start(
{ facingMode:"environment" },

{ fps:10, qrbox:250 },

(code)=>{

console.log("QR code :",code)

openOrder(code)

}

)

}
navigator.geolocation.watchPosition(pos=>{

const lat = pos.coords.latitude
const lon = pos.coords.longitude

supabaseClient
.from("vehicles")
.update({
lat:lat,
lon:lon
})

})
async function startPause(){

await supabaseClient
.from("driver_logs")
.insert({

type:"pause",
time:new Date()

})

}
