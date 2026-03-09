console.log("map.js chargé")

let map

document.addEventListener("DOMContentLoaded",()=>{

const mapDiv = document.getElementById("map")

if(!mapDiv) return

map = L.map("map").setView([46.8,6.6],8)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
maxZoom:19,
attribution:"© OpenStreetMap"
}
).addTo(map)

})


