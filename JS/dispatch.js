async function loadOrders(){

const { data, error } = await supabase
.from("orders")
.select("*")
.eq("status","pending")

const table = document.querySelector("#ordersTable tbody")

table.innerHTML = ""

data.forEach(order=>{

const row = document.createElement("tr")

row.innerHTML = `

<td>${order.id}</td>
<td>${order.delivery_city}</td>
<td>${order.service}</td>

<td>
<button class="btn" onclick="planOrder('${order.id}')">
Planifier
</button>
</td>

`

table.appendChild(row)

})

}

loadOrders()
async function loadStats(){

const { data } = await supabase
.from("orders")
.select("*")

document.getElementById("totalTransports").innerText = data.length

const urgent = data.filter(o=>o.service=="urgent")
document.getElementById("urgentTransports").innerText = urgent.length

const delivered = data.filter(o=>o.status=="delivered")
document.getElementById("deliveredTransports").innerText = delivered.length

}
async function planOrder(orderId){

await supabase
.from("orders")
.update({status:"planned"})
.eq("id",orderId)

loadOrders()

}
