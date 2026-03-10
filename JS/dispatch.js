console.log("dispatch chargé")

const map = L.map('map').setView([46.52,6.63],9)

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:18
}).addTo(map)
