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
