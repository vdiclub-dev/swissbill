console.log("orders.js chargé");
document.addEventListener("DOMContentLoaded",()=>{

loadClientAddress()
loadDestinations()

})

function checkNightDelivery(){

const destination =
document.getElementById("destination")

const nightAllowed =
destination.selectedOptions[0].dataset.night === "true"

const nightSelect =
document.getElementById("night")

if(!nightAllowed){

nightSelect.value="non"
nightSelect.disabled=true

}else{

nightSelect.disabled=false

}

}
async function loadDestinations(){

const { data:{user} } =
await supabaseClient.auth.getUser()

const { data:client } =
await supabaseClient
.from("clients")
.select("id")
.eq("auth_user_id",user.id)
.single()

const { data } =
await supabaseClient
.from("destinations")
.select("*")
.eq("client_id",client.id)

const select =
document.getElementById("destination")

select.innerHTML=""

data.forEach(d=>{

const option = document.createElement("option")

option.value = d.address + ", " + d.city
option.textContent = d.name

option.dataset.night = d.night_allowed

select.appendChild(option)

})

}
async function loadClientAddress(){

const { data:{user} } =
await window.supabaseClient.auth.getUser()

const { data } =
await window.supabaseClient
.from("clients")
.select("*")
.eq("auth_user_id",user.id)
.single()

document.getElementById("pickup").value =
data.address + ", " + data.city

window.clientNightAllowed =
data.night_delivery_allowed

}


/* ---------------------------
   Charger adresse du client
---------------------------- */

async function loadClientAddress(){

const { data:{user} } =
await window.supabaseClient.auth.getUser()

if(!user) return

const { data } =
await window.supabaseClient
.from("clients")
.select("*")
.eq("auth_user_id",user.id)
.single()

if(!data) return

document.getElementById("pickup").value =
data.address + ", " + data.city

}

/* ---------------------------
   Création transport
---------------------------- */

document.addEventListener("DOMContentLoaded",()=>{

loadClientAddress()

const form=document.getElementById("orderForm")

if(!form) return

form.addEventListener("submit",async(e)=>{

e.preventDefault()

const pickup =
document.getElementById("pickup").value

const delivery =
document.getElementById("delivery").value

const weight =
document.getElementById("weight").value

const service =
document.getElementById("service").value

const notes =
document.getElementById("notes").value

const packageType =
document.getElementById("packageType").value

const night =
document.getElementById("night").value==="oui"

const { data:{user} } =
await window.supabaseClient.auth.getUser()

if(!user){
alert("Vous devez être connecté")
return
}

const { error } =
await window.supabaseClient
.from("transport_orders")
.insert([{

company_id:user.id,
client:user.email,
pickup_address:pickup,
delivery_address:delivery,
weight:weight,
service_type:service,
package_type:packageType,
night_delivery:night,
notes:notes,
status:"nouveau"

}])

if(error){

alert(error.message)
return

}

alert("Transport enregistré")

form.reset()

})

})

/* ---------------------------
   Charger transports
---------------------------- */

async function loadOrders(){

const {data,error} =
await window.supabaseClient
.from("transport_orders")
.select("*")
.order("created_at",{ascending:false})

if(!data) return

const table =
document.querySelector("#ordersTable tbody")

table.innerHTML=""

data.forEach(o=>{

const row=document.createElement("tr")

row.innerHTML=`
<td>${o.client}</td>
<td>${o.pickup_address}</td>
<td>${o.delivery_address}</td>
<td>${o.status}</td>
`

table.appendChild(row)

})

}

document.addEventListener("DOMContentLoaded",loadOrders)

/* ---------------------------
   Calcul distance
---------------------------- */

async function calculateDistance(){

const start =
document.getElementById("pickup").value.trim()

const end =
document.getElementById("delivery").value.trim()

if(!start || !end) return

try{

const geo = async(addr)=>{

const r = await fetch(
"https://nominatim.openstreetmap.org/search?format=json&limit=1&q="
+ encodeURIComponent(addr)
)

const d = await r.json()

if(!d.length){
throw new Error("Adresse introuvable")
}

return [Number(d[0].lon),Number(d[0].lat)]

}

const startCoord = await geo(start)
const endCoord = await geo(end)

const key="TON_API_KEY_OPENROUTE"

const url=
"https://api.openrouteservice.org/v2/directions/driving-car?api_key="
+key+
"&start="+startCoord[0]+","+startCoord[1]+
"&end="+endCoord[0]+","+endCoord[1]

const route=await fetch(url)
const data=await route.json()

const routeData=data.features[0]

const distance = routeData.properties.summary.distance
const duration = routeData.properties.summary.duration

const km=distance/1000

document.getElementById("distance").innerText=
km.toFixed(1)

const minutes=Math.round(duration/60)

document.getElementById("duration").innerText=
minutes+" min"

calculatePrice()

}catch(e){

console.error("Erreur distance",e)

}

}

/* ---------------------------
   Calcul prix
---------------------------- */

function calculatePrice(){

const km=
Number(document.getElementById("distance").innerText||0)

const type=
document.getElementById("packageType").value

let price = km*1.2

if(type==="caisse") price+=10
if(type==="palette") price+=20

document.getElementById("price").innerText =
"CHF "+price.toFixed(2)

}

/* ---------------------------
   Fonctions globales
---------------------------- */

window.calculateDistance = calculateDistance
window.calculatePrice = calculatePrice
