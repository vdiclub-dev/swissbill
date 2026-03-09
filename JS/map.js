async function calculateRoute(start, end) {

const key = "CLE_OPENROUTE"

const url =
"https://api.openrouteservice.org/v2/directions/driving-car"

const response = await fetch(url,{
method:"POST",
headers:{
"Authorization":key,
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[
[start.lng,start.lat],
[end.lng,end.lat]
]
})
})

const data = await response.json()

const km = data.routes[0].summary.distance / 1000
const duration = data.routes[0].summary.duration / 60

return {km,duration}
}
const map = L.map('map').setView([46.8, 6.6], 8)

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:19
}).addTo(map)
async function calculateDistance(){

const start =
document.getElementById("pickup_address").value

const end =
document.getElementById("delivery_address").value

if(!start || !end) return

const url =
`https://nominatim.openstreetmap.org/search?format=json&q=${start}`

const res = await fetch(url)

const data = await res.json()

if(!data[0]) return

const lat1 = data[0].lat
const lon1 = data[0].lon

const url2 =
`https://nominatim.openstreetmap.org/search?format=json&q=${end}`

const res2 = await fetch(url2)

const data2 = await res2.json()

if(!data2[0]) return

const lat2 = data2[0].lat
const lon2 = data2[0].lon

const km =
Math.sqrt(
Math.pow(lat2-lat1,2)+
Math.pow(lon2-lon1,2)
)*111

document.getElementById("distance")
.innerText = km.toFixed(1)

calculatePrice()

}
