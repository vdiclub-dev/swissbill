async function loadProducts(){

const res = await db
.from("products")
.select("*")

const tbody = document.getElementById("productsTable")

if(!tbody) return

tbody.innerHTML=""

res.data.forEach(p=>{

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

const res = await db
.from("products")
.insert([{name:name,price:price}])

console.log(res)

loadProducts()

}


document.addEventListener("DOMContentLoaded",()=>{

loadProducts()

})
