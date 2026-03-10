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

function closeModal(){

document.getElementById("modal").style.display="none"

}
function newTransport(){

openModal(
"Créer transport",

`
<input placeholder="Ville destination">

<br><br>

<button class="btn">Créer</button>
`

)

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
