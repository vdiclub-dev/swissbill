async function addClient(){

const company = document.getElementById("company").value
const last_name = document.getElementById("lastname").value
const email = document.getElementById("email").value

await db
.from("clients")
.insert([{company,last_name,email}])

loadClients()

}


async function loadClients(){

const { data } = await db
.from("clients")
.select("*")

const tbody = document.getElementById("clientsTable")

tbody.innerHTML=""

data.forEach(c=>{

tbody.innerHTML += `
<tr>
<td>${c.company}</td>
<td>${c.last_name}</td>
<td>${c.email}</td>
</tr>
`

})

}

document.addEventListener("DOMContentLoaded",()=>{

loadClients()

})
