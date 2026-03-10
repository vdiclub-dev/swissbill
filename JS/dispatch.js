console.log("dispatch chargé")

const map = L.map('map').setView([46.52,6.63],9)

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
maxZoom:18
  
}).addTo(map)
L.marker([46.5197,6.6323])
.addTo(map)
.bindPopup("Test Lausanne")

function openModal(title,content){

document.getElementById("modal-title").innerText = title

document.getElementById("modal-content").innerHTML = content

document.getElementById("modal").style.display="flex"

}
function newTransport(){

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
function closeModal(){

document.getElementById("modal").style.display="none"

}

function newTransport(){

openModal(
"Créer transport",

`
<label>Ville destination</label>
<input type="text" placeholder="Lausanne">

<br><br>

<button class="btn">Créer</button>
`

)

}
async function createTransport(){

const city = document.getElementById("dest").value

if(!city){
alert("Veuillez saisir une destination")
return
}

const { data, error } = await supabase
.from("orders")
.insert([
{
delivery_city: city,
status:"pending"
}
])

if(error){
console.error(error)
alert("Erreur création transport")
return
}

closeModal()

loadOrders()

}
async function createTransport(){

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

if(typeof loadOrders === "function"){
loadOrders()
}

}
