console.log("orders.js chargé");

function calculateDistance(){

console.log("calcul distance lancé");

const start =
document.getElementById("pickup_address").value;

const end =
document.getElementById("delivery_address").value;

if(!start || !end){
alert("Entrer deux adresses");
return;
}

// distance fixe test
const km = 42;

document.getElementById("distance").innerText = km;

calculatePrice();
}

function calculatePrice(){

const km =
Number(document.getElementById("distance").innerText);

const packageType =
document.getElementById("package_type").value;

let price = km * 1.2;

if(packageType === "palette") price += 20;
if(packageType === "box") price += 10;

document.getElementById("price").innerText =
"CHF " + price.toFixed(2);
}

function calculateTransport(){
calculateDistance();
}

window.calculateDistance = calculateDistance;
window.calculatePrice = calculatePrice;
window.calculateTransport = calculateTransport;
