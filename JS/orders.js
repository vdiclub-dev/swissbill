function generateParcelCode(){

const prefix = "LC"

const number = Date.now()

return prefix + number

}
async function searchAddress(term){

if(term.length < 3) return

const results = document.getElementById("addressResults")

try{

const r = await fetch(
"https://nominatim.openstreetmap.org/search?format=json&limit=5&q="
+ encodeURIComponent(term)
)

const data = await r.json()

results.innerHTML=""

data.forEach(a=>{

const div = document.createElement("div")

div.className="address-item"

div.innerText = a.display_name

div.onclick = ()=>{

document.getElementById("delivery_address").value =
a.display_name

results.innerHTML=""

calculateDistance()

}

results.appendChild(div)

})

}catch(e){

console.error("Adresse search erreur",e)

}

}

window.searchAddress = searchAddress
async function loadClientAddress(){

const user = await supabaseClient.auth.getUser()

const email = user.data.user.email

const {data} = await supabaseClient
.from("clients")
.select("*")
.eq("email",email)
.single()

document.getElementById("pickup_address").value =
data.address + ", " + data.city

}
async function loadOrders(){

const {data,error} = await supabaseClient
.from("orders")
.select("*")
.order("created_at",{ascending:false})

const table = document.querySelector("#ordersTable tbody")

table.innerHTML=""

data.forEach(o=>{

const row = document.createElement("tr")

row.innerHTML = `
<td>${new Date(o.created_at).toLocaleDateString()}</td>
<td>${o.pickup_address}</td>
<td>${o.delivery_address}</td>
<td>${o.distance_km} km</td>
<td>${o.status}</td>
`

table.appendChild(row)

})

}

document.addEventListener("DOMContentLoaded",loadOrders)
async function createOrder(){

const clientId = document.getElementById("clientSelect").value
const pickup = document.getElementById("pickup_address").value
const delivery = document.getElementById("delivery_address").value
const distance = document.getElementById("distance").innerText
const duration = document.getElementById("duration").innerText
const price = document.getElementById("price").innerText.replace("CHF ","")

try{

const {data,error} = await supabaseClient
.from("orders")
.insert([{

client_id:clientId,
pickup_address:pickup,
delivery_address:delivery,
distance_km:distance,
duration_min:duration,
price:price,
status:"created"

}])

if(error) throw error

alert("Transport créé")

window.location.href="orders.html"

}catch(err){

console.error(err)
alert("Erreur création transport")

}

}
console.log("orders.js chargé");

async function calculateDistance(){

const start = document.getElementById("pickup_address").value.trim();
const end = document.getElementById("delivery_address").value.trim();

if(!start || !end) return;

try{

// -------- géocodage adresse --------
const geo = async(addr)=>{

const r = await fetch(
"https://nominatim.openstreetmap.org/search?format=json&limit=1&q="
+ encodeURIComponent(addr)
);

const d = await r.json();

if(!d || !d.length){
throw new Error("Adresse introuvable : "+addr);
}

return [Number(d[0].lon),Number(d[0].lat)];

};

// coordonnées
const startCoord = await geo(start);
const endCoord = await geo(end);

// -------- appel OpenRouteService --------
const key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUxMmJjYzg5NTQ4MGNiYWU2NGFjMzg3ZDFlNjJhY2ZmYWUwNmUxYmM0YzY3NmZmMDI5NjVmOTlhIiwiaCI6Im11cm11cjY0In0=";

const url =
"https://api.openrouteservice.org/v2/directions/driving-car?api_key="
+ key +
"&start=" + startCoord[0] + "," + startCoord[1] +
"&end=" + endCoord[0] + "," + endCoord[1];

const route = await fetch(url);
const data = await route.json();

console.log("ORS:",data);

if(!data.features || !data.features.length){
throw new Error("Aucune route trouvée");
}

const routeData = data.features[0];

const distance = routeData.properties.summary.distance;
const duration = routeData.properties.summary.duration;
const coords = routeData.geometry.coordinates;

// -------- carte --------
if(coords && coords.length && window.drawRoute){
drawRoute(coords);
}

// -------- distance --------
const km = distance / 1000;
document.getElementById("distance").innerText = km.toFixed(1);

// -------- durée --------
const minutes = Math.round(duration/60);

let timeText="";

if(minutes>=60){

const h=Math.floor(minutes/60);
const m=minutes%60;

timeText=h+"h "+m+" min";

}else{

timeText=minutes+" min";

}

document.getElementById("duration").innerText=timeText;

// -------- prix --------
calculatePrice();

}catch(e){

console.error("Erreur calcul distance :",e);
alert("Erreur de calcul de distance");

}

}


// -------- calcul prix --------
function calculatePrice(){

const km = Number(document.getElementById("distance").innerText || 0);
const type = document.getElementById("package_type").value;

let price = km * 1.2;

if(type==="box") price += 10;
if(type==="palette") price += 20;

document.getElementById("price").innerText =
"CHF "+price.toFixed(2);

}


// -------- appel manuel --------
function calculateTransport(){
calculateDistance();
}


// -------- rendre fonctions globales --------
window.calculateDistance = calculateDistance;
window.calculatePrice = calculatePrice;
window.calculateTransport = calculateTransport;
