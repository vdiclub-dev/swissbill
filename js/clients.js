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
async function loadProducts(){

const { data, error } = await db
.from("products")
.select("*")
.order("id",{ascending:false})

if(error){
console.log(error)
return
}

const tbody = document.getElementById("productsTable")

tbody.innerHTML=""

data.forEach(p=>{

tbody.innerHTML += `
<tr>
<td>${p.name}</td>
<td>${p.price} CHF</td>
</tr>
`

})

}

async function addProduct(){

const name = document.getElementById("productName").value
const price = document.getElementById("productPrice").value

await db
.from("products")
.insert([{name,price}])

document.getElementById("productName").value=""
document.getElementById("productPrice").value=""

loadProducts()

}
