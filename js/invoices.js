<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">
<title>Facture</title>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<style>

body{
font-family:Arial;
background:#f4f4f4;
padding:40px;
}

.card{
background:white;
padding:30px;
border-radius:10px;
max-width:700px;
margin:auto;
}

table{
width:100%;
border-collapse:collapse;
margin-top:20px;
}

td,th{
padding:10px;
border-bottom:1px solid #ddd;
}

</style>

</head>

<body>

<div class="card">

<h2 id="number"></h2>

<div id="client"></div>

<h3 id="amount"></h3>

</div>

<script src="js/supabase.js"></script>

<script>

const params=new URLSearchParams(window.location.search)

const invoice=params.get("id")

loadInvoice()

async function loadInvoice(){

const { data } = await supabaseClient
.from("invoices")
.select("*")
.eq("invoice_number",invoice)
.single()

document.getElementById("number").innerText="Facture "+data.invoice_number
document.getElementById("client").innerText=data.client
document.getElementById("amount").innerText=data.amount+" CHF"

}

</script>

</body>

</html>
