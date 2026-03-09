console.log("login.js chargé")

const sb = window.supabaseClient

document.addEventListener("DOMContentLoaded", () => {

const form = document.getElementById("loginForm")

if(!form){
console.error("loginForm introuvable")
return
}

form.addEventListener("submit", async (e)=>{

e.preventDefault()

const email = document.getElementById("email").value.trim()
const password = document.getElementById("password").value.trim()

try{

const { data, error } = await sb.auth.signInWithPassword({

email : email,
password : password

})

if(error) throw error

console.log("connecté", data)

window.location.href = "portal.html"

}catch(err){

alert(err.message)

}

})

})
