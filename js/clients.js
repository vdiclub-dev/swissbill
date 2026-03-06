async function loadClients(){

const { data, error } = await db
.from("clients")
.select("*")
.order("id",{ascending:false})

if(error){
console.log("Erreur clients:",error)
return
}

const tbody = document.getElementById("clientsTable")

if(!tbody) return

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
