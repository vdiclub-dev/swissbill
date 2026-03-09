console.log("orders.js chargé")

async function calculateDistance(){

const start = document.getElementById("pickup_address").value
const end = document.getElementById("delivery_address").value

if(!start || !end){
alert("Entrez les deux adresses")
return
}

try{

// géocoder adresse
const geo = async(addr)=>{

const r = await fetch(
"https://nominatim.openstreetmap.org/search?format=json&q="+encodeURIComponent(addr)
)

const d = await r.json()

if(!d || d.length === 0){
throw new Error("Adresse introuvable")
}

return [d[0].lon,d[0].lat]

}

const startCoord = await geo(start)
const endCoord = await geo(end)

// API key ORS
const key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0="

// appel API
const route = await fetch(
"https://api.openrouteservice.org/v2/directions/driving-car",
{
method:"POST",
headers:{
Authorization:key,
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[
[startCoord[0],startCoord[1]],
[endCoord[0],endCoord[1]]
]
})
})

const data = await route.json()

console.log(data)

if(!data.routes){
alert("Impossible de trouver un trajet")
return
}

const distance = data.routes[0].summary.distance
const duration = data.routes[0].summary.duration

const km = distance/1000
const minutes = duration/60

document.getElementById("distance").innerText = km.toFixed(1)
document.getElementById("duration").innerText = minutes.toFixed(0)

calculatePrice()

}catch(e){

console.error(e)
alert("Erreur calcul distance")

}

}

function calculatePrice(){

const km = Number(document.getElementById("distance").innerText || 0)
const type = document.getElementById("package_type").value

let price = km * 1.2

if(type==="box") price += 10
if(type==="palette") price += 20

document.getElementById("price").innerText = "CHF "+price.toFixed(2)

}

function calculateTransport(){
calculateDistance()
}

window.calculateDistance = calculateDistance
window.calculatePrice = calculatePrice
window.calculateTransport = calculateTransport
