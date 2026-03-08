async function loadDashboard(){

const { data } = await db
.from("transport_orders")
.select("*")

let enCours = 0
let livres = 0

data.forEach(o => {

if(o.Statut === "livré"){
livres++
}else{
enCours++
}

})

document.getElementById("ordersCount").innerText = enCours
document.getElementById("deliveredCount").innerText = livres

}
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
async function loadOrders(){

const {data} = await db
.from("transport_orders")
.select("*")

const table = document.getElementById("ordersTable")

table.innerHTML=""

data.forEach(o=>{

table.innerHTML+=`
<tr>
<td>${o.Client}</td>
<td>${o.pickup_address}</td>
<td>${o.delivery_address}</td>
<td>${o.Distance}</td>
<td>${o.Prix}</td>
<td>${o.Statut}</td>
</tr>
`

})

}
