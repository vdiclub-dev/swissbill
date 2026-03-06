async function loadClients(){

const {data,error} = await db
.from("clients")
.select("*")

if(error){
console.log(error)
return
}

const tbody = document.getElementById("clientsTable")

if(!tbody) return

tbody.innerHTML = ""

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
