<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">
<title>SwissBill</title>

<link rel="stylesheet" href="css/style.css">
<link rel="icon" href="data:,">

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script src="js/supabase.js"></script>
<script src="js/dashboard.js"></script>
<script src="js/clients.js"></script>
<script src="js/products.js"></script>
<script src="js/invoices.js"></script>

</head>

<body>

<div class="app">

<div class="sidebar">

<h2>SwissBill</h2>

<button onclick="showPage('dashboard')">Dashboard</button>
<button onclick="showPage('clients')">Clients</button>
<button onclick="showPage('products')">Produits</button>
<button onclick="showPage('invoices')">Factures</button>

</div>

<div class="main">

<div id="dashboard" class="page">

<h1>Dashboard</h1>

<p>Bienvenue dans SwissBill</p>

<div id="stats"></div>

</div>

<div id="clients" class="page">

<h1>Clients</h1>

<input id="company" placeholder="Entreprise">
<input id="lastname" placeholder="Nom">
<input id="email" placeholder="Email">

<button onclick="addClient()">Ajouter</button>

<table id="clientsTable">

<thead>
<tr>
<th>Entreprise</th>
<th>Nom</th>
<th>Email</th>
</tr>
</thead>

<tbody></tbody>

</table>

</div>

<div id="products" class="page">

<h1>Produits</h1>

<input id="productName" placeholder="Produit">
<input id="productPrice" placeholder="Prix">

<button onclick="addProduct()">Ajouter</button>

</div>

<div id="invoices" class="page">

<h1>Factures</h1>

<select id="clientSelect"></select>

<input id="amount" placeholder="Montant">

<button onclick="createInvoice()">Créer facture</button>

</div>

</div>

</div>

<script>

function showPage(page){

document.querySelectorAll(".page").forEach(p=>{
p.style.display="none"
})

document.getElementById(page).style.display="block"

}

showPage("dashboard")

</script>

</body>
</html>
