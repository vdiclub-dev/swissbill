async function addClient(){

const company = document.getElementById("c_company").value
const last_name = document.getElementById("c_lastname").value
const email = document.getElementById("c_email").value

await window.supabaseClient
.from("clients")
.insert([{company,last_name,email}])

loadClients()

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
