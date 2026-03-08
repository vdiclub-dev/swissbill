async function signup(){

const company=document.getElementById("company").value
const lastname=document.getElementById("lastname").value
const firstname=document.getElementById("firstname").value
const phone=document.getElementById("phone").value
const address=document.getElementById("address").value
const zip=document.getElementById("zip").value
const city=document.getElementById("city").value

const email=document.getElementById("email").value
const password=document.getElementById("password").value

const { data, error } = await db.auth.signUp({
email:email,
password:password
})

if(error){
alert(error.message)
return
}

await db.from("clients").insert([{
auth_id:data.user.id,
company,
lastname,
firstname,
phone,
address,
zip,
city,
email
}])

alert("Compte créé")

window.location.href="login.html"

}


async function login(){

const email=document.getElementById("loginEmail").value
const password=document.getElementById("loginPassword").value

const { data, error } = await db.auth.signInWithPassword({
email:email,
password:password
})

if(error){
alert("Email ou mot de passe incorrect")
return
}

window.location.href="portal.html"

}
