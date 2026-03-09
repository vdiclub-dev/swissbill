async function calculateDistance(){

let start = document.getElementById("pickup_address").value
let end = document.getElementById("delivery_address").value

if(!start || !end) return

const geo = async (address) => {

const res = await fetch(
`https://api.openrouteservice.org/geocode/search?api_key=${eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0=}&text=${encodeURIComponent(address)}`
)

const data = await res.json()

return data.features[0].geometry.coordinates

}

const startCoord = await geo(start)
const endCoord = await geo(end)

const routeRes = await fetch(
"https://api.openrouteservice.org/v2/directions/driving-car",
{
method:"POST",
headers:{
"Authorization":ORS_API_KEY,
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[startCoord,endCoord]
})
}
)

const routeData = await routeRes.json()

const meters = routeData.routes[0].summary.distance
const km = meters / 1000

document.getElementById("distance").innerText =
km.toFixed(1)

calculatePrice()

}
window.calculateDistance = calculateDistance;
window.calculatePrice = calculatePrice;
window.calculateTransport = calculateTransport;
