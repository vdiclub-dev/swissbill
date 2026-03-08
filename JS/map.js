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
