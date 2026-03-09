function generateLabels(){

const count = document.getElementById("parcel_count").value

const order = "LC"+Date.now()

const container = document.getElementById("labels")

container.innerHTML=""

for(let i=1;i<=count;i++){

const code = order+"-"+i

const div = document.createElement("div")

div.className="label"

div.innerHTML = `
<div class="label-title">Léman-Courses</div>

<svg id="barcode${i}"></svg>

<div class="parcel-number">${code}</div>
`

container.appendChild(div)

JsBarcode(`#barcode${i}`,code,{
format:"CODE128",
width:2,
height:60
})

}

}
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
