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

const payload={

client:document.getElementById("client").value,
ville:document.getElementById("ville").value,
adresse:document.getElementById("adresse").value,

colis:Number(document.getElementById("colis").value),
poids:Number(document.getElementById("poids").value),

delai:document.getElementById("delai").value,
nuit:document.getElementById("nuit").value,
note:document.getElementById("note").value

}

const {error}=await db.from("colis").insert(payload)

if(error){

alert("Erreur : "+error.message)

}else{

alert("Demande envoyée")

}

}
async function loadColis(){

const {data,error}=await db
.from("colis")
.select("*")
.eq("statut","a_planifier")

if(error){

console.log(error)
return

}

data.forEach(c=>{

stops.push({
client:c.client,
ville:c.ville,
adresse:c.adresse,
colis:c.colis,
poids:c.poids
})

})

drawStops()
renderDashboard()

}
async function loadColis(){

const {data,error}=await db.from("colis").select("*")

if(error){

alert("Erreur chargement")

return

}

const table=document.getElementById("colisTable")

table.innerHTML=""

data.forEach(c=>{

table.innerHTML+=`
<tr>
<td>${c.client}</td>
<td>${c.ville}</td>
<td>${c.adresse}</td>
<td>${c.colis}</td>
<td>${c.poids}</td>
</tr>
`

})

}
async function signup(){

const company=document.getElementById("company").value
const lastname=document.getElementById("lastname").value
const firstname=document.getElementById("firstname").value
const address=document.getElementById("address").value
const zip=document.getElementById("zip").value
const city=document.getElementById("city").value
const phone=document.getElementById("phone").value
const email=document.getElementById("email").value
const password=document.getElementById("password").value

const {data,error}=await db.auth.signUp({
email:email,
password:password
})

if(error){
alert(error.message)
return
}

await db.from("clients").insert([{

auth_id:data.user.id,
company:company,
lastname:lastname,
firstname:firstname,
address:address,
zip:zip,
city:city,
phone:phone,
email:email

}])

alert("Compte client créé")

window.location.href="login.html"

}
