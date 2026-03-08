async function createOrder(){

const { data: { user } } = await db.auth.getUser()

const pickup = document.getElementById("pickup").value
const delivery = document.getElementById("delivery").value
const weight = document.getElementById("weight").value

await db
.from("orders")
.insert([{
user_id:user.id,
pickup,
delivery,
weight,
status:"nouveau"
}])

loadOrders()

}
