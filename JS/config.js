console.log("config chargé")

// SUPABASE
const SUPABASE_URL = "https://iubbsnntcreneakbdkmv.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y"

// connexion
const supabaseClient = supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
)

// paramètres entreprise
const COMPANY = {

name : "Léman-Courses",
address : "Impasse des Griottes 3",
city : "1462 Yvonand",
phone : "+41 79 870 04 88"

}

// dépôt départ
const DEPOT = {

lat : 46.807,
lon : 6.741,
address : "Impasse des Griottes 3, Yvonand"

}
