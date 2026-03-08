const sb = window.supabaseClient

async function loadOrders(){

const {data} = await sb
.from("orders")
.select("*")
.order("created_at",{ascending:false})

const table = document.getElementById("ordersTable")

table.innerHTML=""

data.forEach(order=>{

table.innerHTML += `
<tr>

<td>${order.order_number}</td>

<td>${order.pickup_city}</td>

<td>${order.delivery_city}</td>

<td>${order.status}</td>

<td>
<button onclick="setStatus('${order.id}','en_route')">
En route
</button>

<button onclick="setStatus('${order.id}','livre')">
Livré
</button>
</td>

</tr>
`

})

}

async function setStatus(id,status){

await sb
.from("orders")
.update({status:status})
.eq("id",id)

loadOrders()

}

loadOrders()
