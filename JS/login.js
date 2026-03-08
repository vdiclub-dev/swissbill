async function login(){

const email=document.getElementById("email").value
const password=document.getElementById("password").value

const {data,error}=await db.auth.signInWithPassword({
email,
password
})

if(error){
alert("Email ou mot de passe incorrect")
return
}

window.location.href="portal.html"

}

async function signup(){

const email=document.getElementById("email").value
const password=document.getElementById("password").value

const {data,error}=await db.auth.signUp({
email,
password
})

if(error){
alert(error.message)
return
}

alert("Compte créé")

window.location.href="login.html"

}
