console.log("dispatch chargé")
map.setView([lat,lng],10)
async function loadOrdersMap(){

const { data, error } = await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

data.forEach(async order => {

const city = order.delivery_city

const response = await fetch(
`https://nominatim.openstreetmap.org/search?format=json&q=${city}`
)

const result = await response.json()

if(result.length === 0) return

const lat = result[0].lat
const lng = result[0].lon

L.marker([lat,lng])
.addTo(map)
.bindPopup(`
Transport #${order.id}<br>
Destination : ${order.delivery_city}
`)

})

}
/* ---------------------- */
/* CARTE */
/* ---------------------- */

const map = L.map('map').setView([46.52,6.63],9)

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:18
}).addTo(map)


/* ---------------------- */
/* MODAL */
/* ---------------------- */

window.openModal = function(title,content){

document.getElementById("modal-title").innerText = title
document.getElementById("modal-content").innerHTML = content
document.getElementById("modal").style.display = "flex"

}

window.closeModal = function(){

document.getElementById("modal").style.display = "none"

}


/* ---------------------- */
/* CREER TRANSPORT */
/* ---------------------- */

window.newTransport = function(){

openModal(
"Créer transport",
`
<label>Ville destination</label>
<input id="dest" type="text" placeholder="Lausanne">

<br><br>

<button class="btn" onclick="createTransport()">Créer</button>
`
)

}

window.createTransport = async function(){

const cityInput = document.getElementById("dest")

if(!cityInput){
alert("Champ destination introuvable")
return
}

const city = cityInput.value.trim()

if(!city){
alert("Veuillez saisir une destination")
return
}

const { error } = await supabase
.from("orders")
.insert([
{
delivery_city: city,
pickup: "Yverdon",
delivery: city,
speed: "eco",
weight: 1,
status: "pending"
}
])

if(error){
console.error(error)
alert("Erreur création transport")
return
}

alert("Transport créé")

closeModal()

loadOrdersMap()

}


/* ---------------------- */
/* AFFICHER TRANSPORTS */
/* ---------------------- */

async function loadOrdersMap(){

const { data, error } = await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

/* supprimer anciens marqueurs */

map.eachLayer(layer=>{
if(layer instanceof L.Marker){
map.removeLayer(layer)
}
})

const bounds = []

for(const order of data){

const city = order.delivery_city

if(!city) continue

const response = await fetch(
`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`
)

const result = await response.json()

if(result.length === 0) continue

const lat = parseFloat(result[0].lat)
const lng = parseFloat(result[0].lon)

/* créer marqueur */

L.marker([lat,lng])
.addTo(map)
.bindPopup(`
Transport #${order.id}<br>
Destination : ${order.delivery_city}
`)

bounds.push([lat,lng])

}

/* ajuster la carte */

if(bounds.length > 0){
map.fitBounds(bounds,{padding:[50,50]})
}

}

loadOrdersMap()
map.eachLayer(layer=>{
if(layer instanceof L.Marker){
map.removeLayer(layer)
}
})
