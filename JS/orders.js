async function createOrder(){

const { data: { user } } = await db.auth.getUser()

const pickup_company = document.getElementById("pickup_company").value
const pickup_address = document.getElementById("pickup_address").value
const pickup_zip = document.getElementById("pickup_zip").value
const pickup_city = document.getElementById("pickup_city").value

const delivery_company = document.getElementById("delivery_company").value
const delivery_address = document.getElementById("delivery_address").value
const delivery_zip = document.getElementById("delivery_zip").value
const delivery_city = document.getElementById("delivery_city").value

const colis = document.getElementById("colis").value
const weight = document.getElementById("weight").value

const speed = document.getElementById("speed").value

await db
.from("orders")
.insert([{

user_id:user.id,

pickup_company,
pickup_address,
pickup_zip,
pickup_city,

delivery_company,
delivery_address,
delivery_zip,
delivery_city,

colis,
weight,
speed,

status:"nouveau"

}])

alert("Transport créé")

loadOrders()

}
