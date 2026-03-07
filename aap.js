async function loadClients(){

const { data, error } = await db
.from("clients")
.select("*")
.order("id",{ascending:false})

if(error){
console.log(error)
return
}

const tbody = document.getElementById("clientsTable")

tbody.innerHTML=""

data.forEach(c=>{

tbody.innerHTML += `
<tr>
<td>${c.company || ""}</td>
<td>${c.last_name || ""}</td>
<td>${c.email || ""}</td>
</tr>
`

})

}

async function addClient(){

const company = document.getElementById("company").value
const last_name = document.getElementById("lastname").value
const email = document.getElementById("email").value

await db
.from("clients")
.insert([{company,last_name,email}])

document.getElementById("company").value=""
document.getElementById("lastname").value=""
document.getElementById("email").value=""

loadClients()

}

document.addEventListener("DOMContentLoaded",()=>{

loadClients()

})
