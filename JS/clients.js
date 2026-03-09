console.log("clients.js chargé")

const sb = window.supabaseClient

async function loadClients(){

const {data,error} = await sb
.from("clients")
.select("*")
.order("company")

if(error){
console.error(error)
return
}

const select =
document.getElementById("clientSelect")

select.innerHTML =
'<option value="">Choisir un client</option>'

data.forEach(c=>{

const option =
document.createElement("option")

option.value = c.id
option.textContent = c.company

option.dataset.address = c.address
option.dataset.city = c.city

select.appendChild(option)

})

}

function selectClient(){

const select =
document.getElementById("clientSelect")

const option =
select.options[select.selectedIndex]

if(!option.dataset.address) return

document.getElementById("pickup_address").value =
option.dataset.address + ", " + option.dataset.city

}

window.selectClient = selectClient

document.addEventListener("DOMContentLoaded",loadClients)
