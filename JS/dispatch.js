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
