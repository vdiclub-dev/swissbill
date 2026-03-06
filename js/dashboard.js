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
