async function addClient(){

const company=document.getElementById("company").value
const email=document.getElementById("email").value
const phone=document.getElementById("phone").value

const { error } = await supabaseClient
.from("clients")
.insert([{
company:company,
email:email,
phone:phone
}])

if(error){
alert(error.message)
return
}

alert("Client enregistré")

closeClientModal()

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
