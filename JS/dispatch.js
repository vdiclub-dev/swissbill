console.log("dispatch chargé")

/* ---------------------- */
/* CARTE DISPATCH */
/* ---------------------- */

const map = L.map('map').setView([46.52,6.63],9)

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:18
}).addTo(map)

L.marker([46.5197,6.6323])
.addTo(map)
.bindPopup("Test Lausanne")


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
/* OUVRIR MODAL CREATION */
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


/* ---------------------- */
/* CREER TRANSPORT */
/* ---------------------- */

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

}

async function loadOrdersMap(){

const { data, error } = await supabase
.from("orders")
.select("*")

if(error){
console.error(error)
return
}

data.forEach(order=>{



L.marker([lat,lng])
.addTo(map)
.bindPopup(`
Transport #${order.id}
Destination : ${order.delivery_city}
`)

})

}

loadOrdersMap()
