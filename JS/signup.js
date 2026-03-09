document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nom = document.getElementById("nom")?.value.trim() || "";
    const entreprise = document.getElementById("entreprise")?.value.trim() || "";
    const telephone = document.getElementById("telephone")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";

    if (!email || !password || !nom) {
      alert("Merci de remplir au minimum le nom, l’email et le mot de passe.");
      return;
    }

    try {
      if (typeof supabaseClient === "undefined") {
        alert("Erreur : connexion Supabase introuvable dans config.js");
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom,
            entreprise,
            telephone
          }
        }
      });

      if (error) {
        alert("Erreur inscription : " + error.message);
        console.error(error);
        return;
      }

      console.log("Compte créé :", data);

      alert("Compte créé avec succès. Vérifiez votre email si une confirmation est demandée.");

      window.location.href = "login.html";
    } catch (err) {
      console.error(err);
      alert("Une erreur inattendue est survenue.");
    }
  });
});
