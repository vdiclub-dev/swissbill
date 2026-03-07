
function openLogin(){
document.getElementById("loginModal").style.display="block"
}

function closeLogin(){
document.getElementById("loginModal").style.display="none"
}
async function login(){

const email = document.getElementById("loginEmail").value
const password = document.getElementById("loginPassword").value

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


