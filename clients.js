async function addClient(){

const companyInput = document.getElementById("c_company")
const nameInput = document.getElementById("c_lastname")
const emailInput = document.getElementById("c_email")

if(!companyInput || !nameInput || !emailInput){
alert("Formulaire client introuvable")
return
}

const company = companyInput.value
const last_name = nameInput.value
const email = emailInput.value

await window.supabaseClient
.from("clients")
.insert([{company,last_name,email}])

alert("Client ajouté")

}
async function loadClients(){

const { data, error } = await supabaseClient
.from("clients")
.select("company")

if(error){
console.log(error)
return
}

const select=document.getElementById("client")

if(!select) return

select.innerHTML=""

data.forEach(c=>{

const option=document.createElement("option")

option.value=c.company
option.textContent=c.company

select.appendChild(option)

})

}
document.addEventListener("DOMContentLoaded", () => {

const btn = document.getElementById("btnAddClient")

if(btn){
btn.addEventListener("click", addClient)
}

})
