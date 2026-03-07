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
async function sendParcel(){

const payload = {
client:document.getElementById("client").value,
ville:document.getElementById("ville").value,
adresse:document.getElementById("adresse").value,
colis:Number(document.getElementById("colis").value),
poids:Number(document.getElementById("poids").value)
}

await db.from("colis").insert(payload)

alert("Colis envoyé")

}
