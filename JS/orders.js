async function calculateDistance(){

const start =
document.getElementById("pickup_address").value

const end =
document.getElementById("delivery_address").value

if(!start || !end) return

try{

const geo = async (addr)=>{
const r = await fetch(
"https://nominatim.openstreetmap.org/search?format=json&q="
+ encodeURIComponent(addr)
)
const d = await r.json()
return [d[0].lon, d[0].lat]
}

const startCoord = await geo(start)
const endCoord = await geo(end)

const route = await fetch(
"https://api.openrouteservice.org/v2/directions/driving-car",
{
method:"POST",
headers:{
"Authorization":"TA_CLE_OPENROUTE",
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[startCoord,endCoord]
})
}
)

const data = await route.json()

const meters = data.routes[0].summary.distance
const seconds = data.routes[0].summary.duration

const km = meters / 1000
const minutes = seconds / 60

document.getElementById("distance").innerText =
km.toFixed(1)

document.getElementById("duration").innerText =
minutes.toFixed(0)

drawRoute(data.routes[0].geometry.coordinates)

calculatePrice()

}catch(e){

console.error(e)
alert("Impossible de calculer la route")

}

}

function calculatePrice(){

const km =
Number(document.getElementById("distance").innerText);

const packageType =
document.getElementById("package_type").value;

let price = km * 1.2;

if(packageType === "palette") price += 20;
if(packageType === "box") price += 10;

document.getElementById("price").innerText =
"CHF " + price.toFixed(2);
}

function calculateTransport(){
calculateDistance();
}

window.calculateDistance = calculateDistance;
window.calculatePrice = calculatePrice;
window.calculateTransport = calculateTransport;
