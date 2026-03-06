async function loadClientSelect(){

const {data} = await db
.from("clients")
.select("*")

const select = document.getElementById("clientSelect")

select.innerHTML=""

data.forEach(c=>{

select.innerHTML += `<option value="${c.id}">
${c.company}
</option>`

})

}


async function loadProductSelect(){

const {data} = await db
.from("products")
.select("*")

const select = document.getElementById("productSelect")

select.innerHTML=""

data.forEach(p=>{

select.innerHTML += `<option value="${p.id}">
${p.name}
</option>`

})

}


async function createInvoice(){

const client = document.getElementById("clientSelect").value
const product = document.getElementById("productSelect").value
const quantity = document.getElementById("quantity").value

const {data:prod} = await db
.from("products")
.select("*")
.eq("id",product)
.single()

const total = prod.price * quantity

await db
.from("invoices")
.insert([{
client_id:client,
product_id:product,
quantity:quantity,
total:total
}])

loadInvoices()

}


async function loadInvoices(){

const {data} = await db
.from("invoices")
.select("*")

const tbody = document.getElementById("invoicesTable")

tbody.innerHTML=""

data.forEach(i=>{

tbody.innerHTML += `
<tr>
<td>${i.client_id}</td>
<td>${i.product_id}</td>
<td>${i.quantity}</td>
<td>${i.total}</td>
</tr>
`

})

}


document.addEventListener("DOMContentLoaded",()=>{

loadClientSelect()
loadProductSelect()
loadInvoices()

})
