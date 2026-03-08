async function loadOrders(){

const { data: { user } } = await db.auth.getUser()

const { data } = await db
.from("orders")
.select("*")
.eq("user_id", user.id)

const table = document.getElementById("ordersTable")

table.innerHTML = ""

data.forEach(o => {

table.innerHTML += `
<tr>
<td>${o.id}</td>
<td>${o.pickup}</td>
<td>${o.delivery}</td>
<td>${o.status}</td>
</tr>
`

})

}
async function createOrder(){

const { data: { user } } = await db.auth.getUser()

const pickup = document.getElementById("pickup").value
const delivery = document.getElementById("delivery").value
const speed = document.getElementById("speed").value
const weight = document.getElementById("weight").value

await db
.from("orders")
.insert([{
user_id:user.id,
pickup,
delivery,
speed,
weight,
status:"nouveau"
}])

alert("Transport créé")

loadOrders()

}
async function checkLogin(){

const { data } = await db.auth.getSession()

if(!data.session){
window.location.href="login.html"
}

}

async function logout(){

await db.auth.signOut()

window.location.href="login.html"

}

async function loadOrders(){

const { data: userData } = await db.auth.getUser()

if(!userData.user) return

const { data, error } = await db
.from("orders")
.select("*")
.eq("user_id", userData.user.id)

if(error){
console.log("Erreur chargement orders", error)
return
}

const table=document.getElementById("ordersTable")

if(!table) return

table.innerHTML=""

data.forEach(o=>{

table.innerHTML+=`
<tr>
<td>${o.id}</td>
<td>${o.pickup}</td>
<td>${o.delivery}</td>
<td>${o.status}</td>
</tr>
`

})

}

document.addEventListener("DOMContentLoaded", async ()=>{

await checkLogin()
await loadOrders()

})
document.addEventListener("DOMContentLoaded",()=>{
  loadDashboard()
