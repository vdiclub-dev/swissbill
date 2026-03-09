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
