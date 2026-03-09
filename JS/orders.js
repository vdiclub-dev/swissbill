async function calculateDistance(){

let start = document.getElementById("pickup_address").value
let end = document.getElementById("delivery_address").value

if(!start || !end) return

const apiKey = "TA_CLE_OPENROUTE"

const url =
`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI4OTQwOGJlOTE1MDQzNjc5NmQ3NzkzOWQ0YjZjODg4IiwiaCI6Im11cm11cjY0In0=}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`

const res = await fetch(url)
const data = await res.json()

const km = data.features[0].properties.summary.distance / 1000

document.getElementById("distance").innerText =
km.toFixed(1)

calculatePrice()

}
