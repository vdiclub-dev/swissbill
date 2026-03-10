console.log("dispatch chargé")
map.setView([lat,lng],10)

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





/* ---------------------- */
/* AFFICHER TRANSPORTS */
/* ---------------------- */


loadOrdersMap()
map.eachLayer(layer=>{
if(layer instanceof L.Marker){
map.removeLayer(layer)
}
})
