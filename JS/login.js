console.log("login.js chargé")

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

      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      })

      if(error) throw error

      console.log("connecté", data)

      window.location.href = "portal.html"

    }catch(err){

      alert(err.message)

    }

  })

})
