async function createOrder(){

const client = document.getElementById("Client").value
const pickup = document.getElementById("pickup_address").value
const delivery = document.getElementById("delivery_address").value
const distance = document.getElementById("Distance").value
const prix = document.getElementById("Prix").value

await db.from("transport_orders").insert([{

Client:client,
pickup_address:pickup,
delivery_address:delivery,
Distance:distance,
Prix:prix,
Statut:"nouveau"

}])

alert("Transport créé")

loadOrders()

}
