async function loadProducts(){

const { data, error } = await db
.from("products")
.select("*")

if(error){
console.log("Erreur:",error)
return
}

const tbody = document.getElementById("productsTable")

if(!tbody) return

tbody.innerHTML=""

data.forEach(p=>{

tbody.innerHTML += `
<tr>
<td>${p.name}</td>
<td>${p.price}</td>
</tr>
`

})

}


async function addProduct(){

const name = document.getElementById("productName").value
const price = document.getElementById("productPrice").value

const { error } = await db
.from("products")
.insert([{name:name,price:price}])

if(error){
console.log(error)
return
}

document.getElementById("productName").value=""
document.getElementById("productPrice").value=""

loadProducts()

}


document.addEventListener("DOMContentLoaded",()=>{

loadProducts()

})

async function addProduct(){

const name = document.getElementById("productName").value
const price = document.getElementById("productPrice").value

const res = await db
.from("products")
.insert([{name:name,price:price}])

console.log(res)

loadProducts()

}


document.addEventListener("DOMContentLoaded",()=>{

loadProducts()

})
