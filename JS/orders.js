async function calculateDistance(){

const start =
document.getElementById("pickup_address").value

const end =
document.getElementById("delivery_address").value

if(!start || !end) return

const service =
new google.maps.DistanceMatrixService()

service.getDistanceMatrix(
{
origins:[start],
destinations:[end],
travelMode:"DRIVING",
unitSystem:google.maps.UnitSystem.METRIC
},
function(response,status){

if(status !== "OK"){
alert("Erreur calcul distance")
return
}

const meters =
response.rows[0].elements[0].distance.value

const km = meters / 1000

document.getElementById("distance").innerText =
km.toFixed(1)

calculatePrice()

}
)

}
function calculatePrice(){

let km =
Number(document.getElementById("distance").innerText)

let packageType =
document.getElementById("package_type").value

let price = km * 1.20

if(packageType === "palette"){
price += 20
}

document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}
showPoints(startCoord[1], startCoord[0], endCoord[1], endCoord[0])
window.calculateDistance = calculateDistance;
window.calculatePrice = calculatePrice;
window.calculateTransport = calculateTransport;
