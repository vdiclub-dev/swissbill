function addItem(){

const container=document.getElementById("items")

const row=document.createElement("div")

row.className="item-row"

row.innerHTML=`

<input class="desc" placeholder="Description">

<input class="qty" type="number" value="1">

<input class="price" type="number">

`

container.appendChild(row)

}
function generatePDF(invoice){

const { jsPDF } = window.jspdf

const doc = new jsPDF()

doc.text("SwissBill",20,20)
doc.text("Facture N° "+invoice.invoice_number,20,40)

doc.text("Montant HT : "+invoice.total+" CHF",20,60)
doc.text("TVA : "+invoice.tva+" CHF",20,70)

doc.save("facture_"+invoice.invoice_number+".pdf")

}

async function addInvoice(){

const year = new Date().getFullYear()

const { data, error } = await supabaseClient
.from("invoices")
.select("invoice_number")
.ilike("invoice_number",`BR-${year}-%`)
.order("invoice_number",{ascending:false})
.limit(1)

let number=1

if(data.length>0){

const last=data[0].invoice_number
const lastNumber=parseInt(last.split("-")[2])

number=lastNumber+1

}

const invoiceNumber=`BR-${year}-${number.toString().padStart(4,"0")}`

alert("Facture créée")

closeModal()

loadDashboard()

}
function addItem(){

const container=document.getElementById("items")

const row=document.createElement("div")

row.className="item-row"

row.innerHTML=`

<select class="product"></select>

<input class="qty" type="number" value="1">

<input class="price" type="number">

`

container.appendChild(row)

loadProductOptions(row)

}
function loadProductOptions(row){

const select=row.querySelector(".product")

window.products.forEach(p=>{

const option=document.createElement("option")

option.value=p.price
option.textContent=p.name

select.appendChild(option)

})

select.addEventListener("change",function(){

row.querySelector(".price").value=this.value

})

}
function calculateTotal(){

let total=0

const rows=document.querySelectorAll(".item-row")

rows.forEach(r=>{

const qty=Number(r.querySelector(".qty").value)||0
const price=Number(r.querySelector(".price").value)||0

total+=qty*price

})

document.getElementById("amount").value=total

}
function loadProductOptions(row){

const select=row.querySelector(".product")

window.products.forEach(p=>{

const option=document.createElement("option")

option.value=p.price
option.textContent=p.name

select.appendChild(option)

})

select.addEventListener("change",function(){

row.querySelector(".price").value=this.value

calculateTotal()

})

}
function generatePDF(invoiceNumber,client,amount,date){

const { jsPDF } = window.jspdf
const doc = new jsPDF()

const company="Brimot Nettoyage"
const address="Impasse des Griottes 3"
const city="1462 Yvonand"
const iban="CH84 0900 0000 1666 0243 9"

doc.setFontSize(18)
doc.text(company,20,20)

doc.setFontSize(11)
doc.text(address,20,28)
doc.text(city,20,34)

doc.text("Facture N° "+invoiceNumber,150,20)

doc.text("Client :",20,60)
doc.text(client,20,70)

doc.line(20,90,190,90)

doc.text("Description",20,100)
doc.text("Qté",120,100)
doc.text("Prix",150,100)

let y=110

const rows=document.querySelectorAll(".item-row")

rows.forEach(r=>{

const desc=r.querySelector(".desc").value
const qty=r.querySelector(".qty").value
const price=r.querySelector(".price").value

doc.text(desc,20,y)
doc.text(qty.toString(),120,y)
doc.text(price+" CHF",150,y)

y+=10

})

doc.text("TOTAL : "+amount+" CHF",140,y+20)

doc.addPage()

const qrData="Paiement "+amount+" CHF "+invoiceNumber

const canvas=document.createElement("canvas")

QRCode.toCanvas(canvas,qrData,function(){

doc.addImage(canvas.toDataURL(),"PNG",20,40,80,80)

doc.text("IBAN : "+iban,20,140)

doc.save("Facture_"+invoiceNumber+".pdf")

})

}
async function addClient(){

const company=document.getElementById("company").value
const email=document.getElementById("email").value
const phone=document.getElementById("phone").value

const street=document.getElementById("street").value
const postal=document.getElementById("postal_code").value
const city=document.getElementById("city").value
const country=document.getElementById("country").value

const notes=document.getElementById("notes").value

const { error } = await supabaseClient
.from("clients")
.insert([{
company:company,
email:email,
phone:phone,
street:street,
postal_code:postal,
city:city,
country:country,
notes:notes
}])

if(error){
alert(error.message)
return
}

alert("Client enregistré")

closeClientModal()

loadClients()

}
function renderTable(data){

const tbody = document.querySelector("#invoiceTable tbody")

if(!tbody) return

tbody.innerHTML = ""

data.forEach(inv => {

const row = `
<tr>

<td>${inv.invoice_number || ""}</td>

<td>${inv.client}</td>

<td>${inv.amount} CHF</td>

<td>
<button onclick="toggleStatus('${inv.id}','${inv.status}')">
${inv.status}
</button>
</td>

<td>${new Date(inv.date).toLocaleDateString()}</td>

<td>
<button onclick="sendInvoice('${inv.client}','${inv.invoice_number}',${inv.amount})">✉</button>
<button onclick="sendInvoice('${inv.client}','${inv.invoice_number}',${inv.amount})">
✉
</button>

<button onclick="generatePDF('${inv.invoice_number}','${inv.client}',${inv.amount},'${inv.status}','${inv.date}')">
PDF
</button>

<button onclick="deleteInvoice('${inv.id}')">
🗑
</button>

</td>

</tr>
`

tbody.innerHTML += row

})

}
function sendInvoice(client,invoiceNumber,amount){

const link="https://tonsite/invoice.html?id="+invoiceNumber

const subject="Facture "+invoiceNumber

const body=
"Bonjour,\n\n"+
"Vous pouvez consulter votre facture ici :\n\n"+
link+"\n\n"+
"Montant : "+amount+" CHF"

window.location.href=
"mailto:?subject="+encodeURIComponent(subject)+
"&body="+encodeURIComponent(body)

}
function sendInvoice(client,invoiceNumber,amount){

const link="https://tonsite/invoice.html?id="+invoiceNumber

const subject="Facture "+invoiceNumber

const body=
"Bonjour,\n\n"+
"Vous pouvez consulter votre facture ici :\n\n"+
link+"\n\n"+
"Montant : "+amount+" CHF"

window.location.href=
"mailto:?subject="+encodeURIComponent(subject)+
"&body="+encodeURIComponent(body)

}
function remindInvoice(client,invoiceNumber,amount){

const subject="Relance facture "+invoiceNumber

const body=
"Bonjour,\n\n"+
"Notre facture "+invoiceNumber+" d’un montant de "+amount+
" CHF est toujours en attente.\n\n"+
"Merci de votre paiement.\n\n"+
"Cordialement"

window.location.href=
"mailto:?subject="+encodeURIComponent(subject)+
"&body="+encodeURIComponent(body)

}
function addInvoiceRow(){

const tbody = document.querySelector("#invoiceItems tbody")

let row = document.createElement("tr")

row.innerHTML = `
<td><input class="prod"></td>

<td><input class="qty" type="number" value="1"></td>

<td>
<select class="unit">
<option>h</option>
<option>m2</option>
<option>m3</option>
<option>kg</option>
<option>pièce</option>
<option>forfait</option>
<option>km</option>
</select>
</td>

<td><input class="price" type="number"></td>

<td class="total">0</td>
`

tbody.appendChild(row)

row.querySelectorAll(".qty,.price").forEach(el=>{

el.addEventListener("input",()=>{

const qty = row.querySelector(".qty").value
const price = row.querySelector(".price").value

row.querySelector(".total").textContent =
(qty*price).toFixed(2)

})

})

}
