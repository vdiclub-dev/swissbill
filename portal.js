
async function loadOrders(){

const {data} = await db
.from("orders")
.select("*")

const tbody = document.getElementById("ordersTable")

tbody.innerHTML=""

data.forEach(o=>{

tbody.innerHTML += `
<tr>
<td>${o.id}</td>
<td>${o.pickup}</td>
<td>${o.delivery}</td>
<td>${o.status}</td>
</tr>
`

})

}

async function createOrder(){

const pickup = document.getElementById("pickup").value
const delivery = document.getElementById("delivery").value
const speed = document.getElementById("speed").value
const weight = document.getElementById("weight").value

await db
.from("orders")
.insert([{
pickup,
delivery,
speed,
weight,
status:"nouveau"
}])

loadOrders()

}

document.addEventListener("DOMContentLoaded",loadOrders)
