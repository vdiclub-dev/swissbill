async function checkUser(){

const {data}=await db.auth.getSession()

if(!data.session){

window.location.href="login.html"

}

}

document.addEventListener("DOMContentLoaded",checkUser)
