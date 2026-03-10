async function signup(){

const email=document.getElementById("email").value
const password=document.getElementById("password").value

const {data,error}=await db.auth.signUp({
email:email,
password:password
})

if(error){
alert(error.message)
return
}

alert("Compte créé. Vérifiez votre email.")

}
