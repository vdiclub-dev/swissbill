let map
let stops=[]

function initMap(){

if(!document.getElementById("map")) return

map = L.map('map').setView([46.8,7.2],8)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
maxZoom:19
}).addTo(map)

}



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

const {error}=await db.from("colis").insert([payload])

if(error){

alert("Erreur : "+error.message)

}else{

alert("Demande envoyée")

loadColis()

}

}
async function login(){

const email = document.getElementById("email").value
const password = document.getElementById("password").value

const {data,error} = await db.auth.signInWithPassword({
email:email,
password:password
})

if(error){
alert("Email ou mot de passe incorrect")
return
}

window.location.href="portal.html"

}
