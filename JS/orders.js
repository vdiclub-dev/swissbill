async function calculateDistance(){

let start = document.getElementById("pickup_address").value
let end = document.getElementById("delivery_address").value

if(!start || !end) return

const apiKey = "TA_CLE_API"

const geoUrl = (addr)=>
`https://api.openrouteservice.org/geocode/search?api_key=${eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0=}&text=${encodeURIComponent(addr)}`

const startRes = await fetch(geoUrl(start))
const startData = await startRes.json()

const endRes = await fetch(geoUrl(end))
const endData = await endRes.json()

const startCoord = startData.features[0].geometry.coordinates
const endCoord = endData.features[0].geometry.coordinates

const routeRes = await fetch(
"https://api.openrouteservice.org/v2/directions/driving-car",
{
method:"POST",
headers:{
"Authorization":apiKey,
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[startCoord,endCoord]
})
})

const routeData = await routeRes.json()

const meters = routeData.routes[0].summary.distance

const km = meters/1000

document.getElementById("distance").innerText =
km.toFixed(1)

calculatePrice()

}
