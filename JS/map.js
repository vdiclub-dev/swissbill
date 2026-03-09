console.log("map.js chargé");

let map;
let routeLayer = null;
let startMarker = null;
let endMarker = null;

document.addEventListener("DOMContentLoaded", () => {

  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;

  map = L.map("map").setView([46.8, 6.6], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

});

function drawRoute(coords){

if(!map) return;

if(routeLayer) map.removeLayer(routeLayer);
if(startMarker) map.removeLayer(startMarker);
if(endMarker) map.removeLayer(endMarker);

const latlngs = coords.map(c => [c[1],c[0]]);

routeLayer = L.polyline(latlngs,{
color:"red",
weight:4
}).addTo(map);

startMarker = L.marker(latlngs[0]).addTo(map);
endMarker = L.marker(latlngs[latlngs.length-1]).addTo(map);

map.fitBounds(routeLayer.getBounds(),{padding:[30,30]});

}

window.drawRoute = drawRoute;
