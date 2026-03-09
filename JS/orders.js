function calculateDistance(){

let start = document.getElementById("pickup_address").value
let end = document.getElementById("delivery_address").value

if(!start || !end) return

// simulation distance
let km = Math.floor(Math.random()*80)+10

document.getElementById("distance").innerText = km

calculatePrice()

}


function calculateTransport(){

calculateDistance()

}


function calculatePrice(){

let km = Number(document.getElementById("distance").innerText)

let packageType = document.getElementById("package_type").value

let price = km * 1.20

if(packageType === "palette"){
price += 20
}

document.getElementById("price").innerText =
"CHF " + price.toFixed(2)

}
