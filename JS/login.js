async function login(){

const email = document.getElementById("email").value
const password = document.getElementById("password").value

const {data,error} = await db.auth.signInWithPassword({

email:email,
password:password

})

if(error){

alert("Erreur connexion")

return

}

window.location.href = "portal.html"

}
async function login(){

const email = document.getElementById("email").value
const password = document.getElementById("password").value

const {data,error} = await db.auth.signInWithPassword({
email:email,
password:password
})

if(error){
alert("Email ou mot de passe incorrect")
return
}

window.location.href="portal.html"

}
async function checkLogin(){

const {data} = await db.auth.getSession()

if(!data.session){

window.location.href="login.html"

}

}

document.addEventListener("DOMContentLoaded",checkLogin)
