let map

function initMap(){

map = L.map('map').setView([46.8,7.2],8)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
maxZoom:19
}).addTo(map)

}

document.addEventListener("DOMContentLoaded", () => {

initMap()

})
