async function loadProducts(){

const { data, error } = await db
.from("products")
.select("*")
.order("id",{ascending:false})

if(error){
console.log("Erreur:",error)
return
}

const tbody = document.getElementById("productsTable")

if(!tbody) return

tbody.innerHTML = ""

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

const { error } = await db
.from("products")
.insert([{name,price}])

if(error){
console.log("Erreur insertion:",error)
return
}

document.getElementById("productName").value=""
document.getElementById("productPrice").value=""

loadProducts()

}


document.addEventListener("DOMContentLoaded",()=>{

loadProducts()

})
