console.log("orders.js chargé");

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0=";   // ta clé ici

async function calculateDistance(){

const start = document.getElementById("pickup_address").value
const end = document.getElementById("delivery_address").value

if(!start || !end){
alert("Saisir adresse enlèvement et livraison")
return
}

try{

// géocodage adresse départ
const geoStart = await fetch(
`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(start)}`
)

const startData = await geoStart.json()

// géocodage adresse arrivée
const geoEnd = await fetch(
`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(end)}`
)

const endData = await geoEnd.json()

const startCoord = startData.features[0].geometry.coordinates
const endCoord = endData.features[0].geometry.coordinates

// calcul route
const route = await fetch(
"https://api.openrouteservice.org/v2/directions/driving-car",
{
method:"POST",
headers:{
"Authorization": ORS_API_KEY,
"Content-Type":"application/json"
},
body: JSON.stringify({
coordinates:[startCoord,endCoord]
})
}
)

const routeData = await route.json()

const meters = routeData.routes[0].summary.distance
const km = meters / 1000

document.getElementById("distance").innerText = km.toFixed(1)

calculatePrice()

}catch(e){

console.error(e)
alert("Impossible de calculer la distance")

}

}

function calculatePrice(){

const km = Number(document.getElementById("distance").innerText)

const packageType =
document.getElementById("package_type").value

let price = km * 1.20

if(packageType === "palette"){
price += 20
}

if(packageType === "box"){
price += 10
}

document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}

function calculateTransport(){
calculateDistance()
}

// rendre fonctions globales
window.calculateDistance = calculateDistance
window.calculatePrice = calculatePrice
window.calculateTransport = calculateTransport
