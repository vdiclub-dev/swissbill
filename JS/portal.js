async function logout(){

const { error } = await db.auth.signOut()

if(error){
alert("Erreur déconnexion")
return
}

window.location.href="login.html"

}
const { data: { user } } = await db.auth.getUser()

const { data } = await db
.from("orders")
.select("*")
.eq("user_id",user.id)
const { data: { user } } = await db.auth.getUser()

await db.from("orders").insert([{
user_id:user.id,
pickup,
delivery,
speed,
weight,
status:"nouveau"
}])
// vérifier si utilisateur connecté
async function checkLogin(){

const { data } = await db.auth.getSession()

if(!data.session){
window.location.href="login.html"
}

}

document.addEventListener("DOMContentLoaded",checkLogin)


// créer transport
async function createOrder(){

async function createOrder(){

const { data, error } = await db.auth.getUser()

if(!data.user

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

// charger transports
async function loadOrders(){

const { data: { user } } = await db.auth.getUser()

const { data } = await db
.from("orders")
.select("*")
.eq("user_id",user.id)

const tbody = document.getElementById("ordersTable")

if(!tbody) return

tbody.innerHTML=""

data.forEach(o=>{

tbody.innerHTML += `
<tr>
<td>${o.id}</td>
<td>${o.pickup}</td>
<td>${o.delivery}</td>
<td>${o.status}</td>
</tr>
`

})

}

// déconnexion
async function logout(){

await db.auth.signOut()

window.location.href="login.html"

}

// session inactive 30 min
let inactivityTimer

function resetTimer(){

clearTimeout(inactivityTimer)

inactivityTimer=setTimeout(logout,1800000)

}

document.addEventListener("mousemove",resetTimer)
document.addEventListener("keydown",resetTimer)

// lancement page
document.addEventListener("DOMContentLoaded",()=>{

checkLogin()
loadOrders()
resetTimer()

})
