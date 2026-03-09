console.log("clients.js chargé")

function selectClient(client){

document.getElementById("pickup_address").value =
client.adresse + " " + client.ville

calculateDistance()

}

async function loadClients(){

const {data,error} =
await supabaseClient
.from("clients")
.select("*")

console.log(data)

const select =
document.getElementById("clientSelect")

select.innerHTML =
'<option value="">Choisir un client</option>'

data.forEach(client=>{

const option =
document.createElement("option")

option.value = client.id
option.textContent = client.company

option.dataset.address = client.address
option.dataset.city = client.city

select.appendChild(option)

})

}

function selectClient(){

const select =
document.getElementById("clientSelect")

const option =
select.options[select.selectedIndex]

document.getElementById("pickup_address").value =
option.dataset.address + ", " + option.dataset.city

}

document.addEventListener("DOMContentLoaded",loadClients)

window.selectClient = selectClient
