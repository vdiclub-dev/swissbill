<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>

const SUPABASE_URL = "https://iubbsnntcreneakbdkmv.supabase.co";

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YmJzbm50Y3JlbmVha2Jka212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDYsImV4cCI6MjA4ODE0ODUwNn0.FzMgCZxNIej1skSIc8UAGiODcZEZW1GCWZwBfonm_1Y";

const { createClient } = supabase;

window.supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("Supabase connecté", window.supabaseClient);

</script>
