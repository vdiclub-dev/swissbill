console.log("orders.js chargé")

function calculateDistance(){

const start =
document.getElementById("pickup_address").value

const end =
document.getElementById("delivery_address").value

if(!start || !end){
alert("Entrer les deux adresses")
return
}

const km = 25

document.getElementById("distance").innerText = km

calculatePrice()

}

function calculatePrice(){

const km =
Number(document.getElementById("distance").innerText)

const type =
document.getElementById("package_type").value

let price = km * 1.2

if(type==="palette") price += 20
if(type==="box") price += 10

document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}

function calculateTransport(){
calculateDistance()
}

window.calculateDistance = calculateDistance
window.calculatePrice = calculatePrice
window.calculateTransport = calculateTransport
