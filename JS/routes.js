const sb = window.supabaseClient

async function loadRoutes(){

const today =
new Date().toISOString().slice(0,10)

const {data} = await sb
.from("orders")
.select("*")
.gte("created_at", today)

const table =
document.getElementById("routesTable")

table.innerHTML=""

data.forEach(o=>{

table.innerHTML += `
<tr>

<td>${o.order_number}</td>

<td>${o.pickup_city}</td>

<td>${o.delivery_city}</td>

<td>${o.status}</td>

</tr>
`

})

}

loadRoutes()
