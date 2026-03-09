console.log("map.js chargé")
let routeLayer = null;

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
drawRoute(data.features[0].geometry.coordinates)
const minutes = data.features[0].properties.summary.duration / 60
