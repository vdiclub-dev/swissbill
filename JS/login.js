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
