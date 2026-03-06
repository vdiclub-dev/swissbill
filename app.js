async function loadClientSelect(){

const {data,error} = await window.db
.from("clients")
.select("*")

if(error){
console.log(error)
return
}

const select=document.getElementById("clientSelect")

select.innerHTML=""

data.forEach(c=>{

let option=document.createElement("option")

option.value=c.id
option.textContent=c.company || c.last_name

select.appendChild(option)

})

}

async function addClient(){

const company=document.getElementById("company").value
const last=document.getElementById("lastname").value
const email=document.getElementById("email").value

const {error}=await window.db
.from("clients")
.insert([{company,last_name:last,email}])

if(error){
console.log(error)
alert("Erreur")
return
}

loadClients()

}

async function loadClientSelect(){

const {data,error} = await window.db
.from("clients")
.select("*")

if(error){
console.log(error)
return
}

const select=document.getElementById("clientSelect")

select.innerHTML=""

data.forEach(c=>{

let option=document.createElement("option")

option.value=c.id
option.textContent=c.company || c.last_name

select.appendChild(option)

})

}

async function createInvoice(){

const client=document.getElementById("clientSelect").value
const amount=document.getElementById("amount").value

const {error}=await window.db
.from("invoices")
.insert([{
client_id:client,
total:amount
}])

if(error){
console.log(error)
alert("Erreur facture")
return
}

alert("Facture créée")

}
loadClients()
loadClientSelect()
