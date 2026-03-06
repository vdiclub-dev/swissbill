async function loadProducts(){

const { data, error } = await supabaseClient
.from("products")
.select("*")

if(error){
console.log(error)
return
}

window.products=data

}
async function loadProducts(){

const { data } = await supabaseClient
.from("products")
.select("*")

window.products=data

}
async function loadProducts(){

const { data, error } = await supabaseClient
.from("products")
.select("*")

if(error){
console.log(error)
return
}

window.products=data

}
async function addProduct(){

const name = document.getElementById("p_name").value
const price = document.getElementById("p_price").value

await window.supabaseClient
.from("products")
.insert([{name,price}])

}
