async function loadOrders(){

const {data} = await db
.from("orders")
.select("*")

const tbody = document.getElementById("ordersTable")

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

async function createOrder(){

const pickup = document.getElementById("pickup").value
const delivery = document.getElementById("delivery").value
const speed = document.getElementById("speed").value
const weight = document.getElementById("weight").value

await db
.from("orders")
.insert([{
pickup,
delivery,
speed,
weight,
status:"nouveau"
}])

loadOrders()

}
async function login(){

const email = document.getElementById("loginEmail").value
const password = document.getElementById("loginPassword").value

const {data,error} = await db.auth.signInWithPassword({
email:email,
password:password
})

if(error){
alert("Erreur connexion")
return
}

alert("Connexion réussie")

loadOrders()

}
async function signup(){

const email = document.getElementById("signupEmail").value
const password = document.getElementById("signupPassword").value

const {data,error} = await db.auth.signUp({
email:email,
password:password
})

if(error){
alert("Erreur inscription")
return
}

alert("Compte créé")

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

loadOrders()

}
async function loadOrders(){

const { data: { user } } = await db.auth.getUser()

const {data} = await db
.from("orders")
.select("*")
.eq("user_id",user.id)

const tbody = document.getElementById("ordersTable")

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
async function createOrder(){

const pickup=document.getElementById("pickup").value
const delivery=document.getElementById("delivery").value
const speed=document.getElementById("speed").value

const user=await db.auth.getUser()

await db.from("orders").insert([{

user_id:user.data.user.id,
pickup:pickup,
delivery:delivery,
speed:speed,
status:"nouveau"

}])

alert("Transport créé")

loadOrders()

}

async function loadOrders(){

const user=await db.auth.getUser()

const {data}=await db
.from("orders")
.select("*")
.eq("user_id",user.data.user.id)

const table=document.getElementById("ordersTable")

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

async function logout(){

await db.auth.signOut()

window.location.href="login.html"

}

document.addEventListener("DOMContentLoaded",loadOrders)
document.addEventListener("DOMContentLoaded",loadOrders)
async function checkLogin(){

const {data} = await db.auth.getSession()

if(!data.session){

window.location.href="login.html"

}

}

document.addEventListener("DOMContentLoaded",checkLogin)
async function checkLogin(){

const { data } = await db.auth.getSession()

if(!data.session){
    
    window.location.href="login.html"

}

}

document.addEventListener("DOMContentLoaded",checkLogin)
let inactivityTimer

function resetTimer(){

clearTimeout(inactivityTimer)

inactivityTimer=setTimeout(logout,1800000)

}

function logout(){

db.auth.signOut()

alert("Session expirée")

window.location.href="login.html"

}

document.addEventListener("mousemove",resetTimer)
document.addEventListener("keydown",resetTimer)

resetTimer()
