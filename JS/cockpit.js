console.log("cockpit chargé")

let map

document.addEventListener("DOMContentLoaded",init)

function init(){

map = L.map("map").setView([46.8,6.6],8)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
).addTo(map)

loadDrivers()

}

async function loadDrivers(){

const {data} = await supabaseClient
.from("vehicles")
.select("*")

data.forEach(v=>{

L.marker([v.lat,v.lon])
.addTo(map)
.bindPopup("Chauffeur")

})

}
