function calculatePrice(){

let km =
Number(document.getElementById("distance").innerText)

let packageType =
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
async function calculateDistance(){

let start = document.getElementById("pickup_address").value
let end = document.getElementById("delivery_address").value

if(!start || !end) return

const apiKey = "TA_CLE_OPENROUTE"

const geo = async (addr)=>{
const res = await fetch(
`https://api.openrouteservice.org/geocode/search?api_key=${eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0=}&text=${encodeURIComponent(addr)}`
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
"Authorization":apiKey,
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[startCoord,endCoord]
})
}
)

const routeData = await routeRes.json()

const meters = routeData.routes[0].summary.distance
const km = meters/1000

document.getElementById("distance").innerText =
km.toFixed(1)

calculatePrice()

}
