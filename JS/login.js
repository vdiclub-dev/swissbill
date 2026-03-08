const sbLogin = window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      try {
        const { error } = await sbLogin.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        UI.toast("Connexion réussie", "success");
        window.location.href = "/portal.html";
      } catch (err) {
        UI.toast(err.message || "Erreur de connexion", "error");
      }
    });
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nom = document.getElementById("nom").value.trim();
      const entreprise = document.getElementById("entreprise").value.trim();
      const email = document.getElementById("email").value.trim();
      const telephone = document.getElementById("telephone").value.trim();
      const password = document.getElementById("password").value.trim();

      try {
        const { data, error } = await sbLogin.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        const authUserId = data.user?.id;
        if (!authUserId) {
          throw new Error("Utilisateur non créé.");
        }

        const clientNumber = "LC-" + Date.now();

        const { error: insertError } = await sbLogin
          .from("clients")
          .insert([{
            auth_user_id: authUserId,
            client_number: clientNumber,
            nom,
            entreprise,
            email,
            telephone
          }]);

        if (insertError) throw insertError;

        UI.toast("Compte créé avec succès", "success");
        window.location.href = "/confirm.html";
      } catch (err) {
        UI.toast(err.message || "Erreur lors de l'inscription", "error");
      }
    });
  }
});
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
