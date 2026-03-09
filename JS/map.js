console.log("maps.js chargé")

// centre Suisse
const map = L.map('map').setView([46.8, 6.6], 8)

// fond de carte OpenStreetMap
L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom: 19,
attribution: '© OpenStreetMap'
}).addTo(map)

let markerStart = null
let markerEnd = null
function showPoints(lat1, lon1, lat2, lon2){

if(markerStart) map.removeLayer(markerStart)
if(markerEnd) map.removeLayer(markerEnd)

markerStart = L.marker([lat1, lon1]).addTo(map)
markerEnd = L.marker([lat2, lon2]).addTo(map)

map.fitBounds([
[lat1, lon1],
[lat2, lon2]
])

}
let routeLayer = null

function drawRoute(coords){

if(routeLayer){
map.removeLayer(routeLayer)
}

const latlngs = coords.map(c => [c[1], c[0]])

routeLayer = L.polyline(latlngs,{
color:"red",
weight:4
}).addTo(map)

map.fitBounds(routeLayer.getBounds())

}
