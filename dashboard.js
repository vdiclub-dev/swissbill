async function loadDashboard(){

const container=document.querySelector(".container")

container.innerHTML=`

<h3>Factures</h3>

<table id="invoiceTable">

<thead>
<tr>
<th>Client</th>
<th>Montant</th>
<th>Status</th>
<th>Date</th>
</tr>
</thead>

<tbody></tbody>

</table>
`

const { data } = await supabaseClient
.from("invoices")
.select("*")

const tbody=document.querySelector("#invoiceTable tbody")

data.forEach(inv=>{

const row=`
<tr>
<td>${inv.client}</td>
<td>${inv.amount} CHF</td>
<td>${inv.status}</td>
<td>${new Date(inv.date).toLocaleDateString()}</td>
</tr>
`
renderTable(data)
tbody.innerHTML+=row

})

}
let total=0
let paid=0
let pending=0

data.forEach(inv=>{

const amount=Number(inv.amount)||0

total+=amount

if(inv.status==="paid") paid+=amount
else pending+=amount

})
document.getElementById("total").innerText=total+" CHF"
document.getElementById("paid").innerText=paid+" CHF"
document.getElementById("pending").innerText=pending+" CHF"