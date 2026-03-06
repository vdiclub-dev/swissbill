async function loadDashboard(){

// récupérer les factures
const {data} = await db
.from("invoices")
.select("total,created_at")

let months = {}
let labels = []
let values = []

data.forEach(f=>{

let d = new Date(f.created_at)
let m = d.getFullYear()+"-"+(d.getMonth()+1)

if(!months[m]) months[m]=0

months[m] += f.total

})

labels = Object.keys(months)
values = Object.values(months)

const ctx = document.getElementById("revenueChart")

new Chart(ctx,{
type:"bar",
data:{
labels:labels,
datasets:[{
label:"Chiffre d'affaires",
data:values
}]
}
})

}
async function loadDashboard(){

// clients
const {data:clients} = await db
.from("clients")
.select("*")

document.getElementById("clientCount").textContent = clients.length


// produits
const {data:products} = await db
.from("products")
.select("*")

document.getElementById("productCount").textContent = products.length


// factures
const {data:invoices} = await db
.from("invoices")
.select("*")

document.getElementById("invoiceCount").textContent = invoices.length


// chiffre d'affaires
let total = 0

invoices.forEach(i=>{
total += i.total
})

document.getElementById("revenueTotal").textContent = total + " CHF"


// graphique

let months = {}
let labels=[]
let values=[]

invoices.forEach(f=>{

let d = new Date(f.created_at)
let m = d.getFullYear()+"-"+(d.getMonth()+1)

if(!months[m]) months[m]=0

months[m]+=f.total

})

labels = Object.keys(months)
values = Object.values(months)

const ctx = document.getElementById("revenueChart")

new Chart(ctx,{
type:"line",
data:{
labels:labels,
datasets:[{
label:"Revenus",
data:values,
borderColor:"#2563eb",
fill:false
}]
}
})

}

document.addEventListener("DOMContentLoaded",loadDashboard)
