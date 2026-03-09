console.log("orders.js chargé");

async function calculateDistance(){

const start = document.getElementById("pickup_address").value.trim();
const end = document.getElementById("delivery_address").value.trim();

if(!start || !end) return;

try{

const geo = async(addr)=>{

const r = await fetch(
"https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(addr)
);

const d = await r.json();

if(!d || !d.length){
throw new Error("Adresse introuvable : "+addr);
}

return [Number(d[0].lon),Number(d[0].lat)];

};

const startCoord = await geo(start);
const endCoord = await geo(end);

const key = "TA_CLE_OPENROUTE";

const route = await fetch(
"https://api.openrouteservice.org/v2/directions/driving-car",
{
method:"POST",
headers:{
Authorization:key,
"Content-Type":"application/json"
},
body:JSON.stringify({
coordinates:[startCoord,endCoord]
})
}
);

const data = await route.json();

console.log("ORS:",data);

if(!data.routes || !data.routes.length){
throw new Error("Aucune route trouvée");
}

const routeData = data.routes[0];

const distance = routeData.summary.distance;
const duration = routeData.summary.duration;
const coords = routeData.geometry.coordinates;

if(coords && coords.length && window.drawRoute){
drawRoute(coords);
}

const km = distance / 1000;
document.getElementById("distance").innerText = km.toFixed(1);

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

calculatePrice();

}catch(e){

console.error("Erreur calcul distance :",e);
alert("Erreur de calcul de distance");

}

}

function calculatePrice(){

const km=Number(document.getElementById("distance").innerText||0);
const type=document.getElementById("package_type").value;

let price=km*1.2;

if(type==="box") price+=10;
if(type==="palette") price+=20;

document.getElementById("price").innerText="CHF "+price.toFixed(2);

}

function calculateTransport(){
calculateDistance();
}

window.calculateDistance=calculateDistance;
window.calculatePrice=calculatePrice;
window.calculateTransport=calculateTransport;
