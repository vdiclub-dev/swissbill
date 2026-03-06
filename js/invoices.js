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
function generateQR(amount){

const payload = `
SPC
0200
1
CH773000520427805601Y
S
SwissBill
Rue Exemple
1
1000
Lausanne
CH



${amount}
CHF



Facture SwissBill
EPD
`

QRCode.toCanvas(
document.getElementById("qrCanvas"),
payload,
function(error){
if(error) console.error(error)
console.log("QR généré")
})

}
function generatePDF(amount){

const { jsPDF } = window.jspdf

const doc = new jsPDF()

doc.setFontSize(18)
doc.text("SwissBill",20,20)

doc.setFontSize(12)

doc.text("Facture",20,40)
doc.text("Montant : " + amount + " CHF",20,50)
doc.text("TVA 8.1%",20,60)

doc.text("QR facture ci-dessous",20,80)

const canvas = document.getElementById("qrCanvas")

if(canvas){

const img = canvas.toDataURL("image/png")

doc.addImage(img,"PNG",20,90,60,60)

}

doc.save("facture.pdf")

}
