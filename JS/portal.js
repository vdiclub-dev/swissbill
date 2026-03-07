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

const { data: { user } } = await db.auth.getUser()

const { data } = await db
.from("orders")
.select("*")
.eq("user_id",user.id)

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

document.addEventListener("DOMContentLoaded",()=>{

checkLogin()
loadOrders()

})
