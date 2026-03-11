export default async function handler(req,res){

try{

const { depot, orders } = req.body

const response = await fetch(
"https://api.deepseek.com/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":"Bearer TON_API_KEY"
},
body: JSON.stringify({

model:"deepseek-chat",

messages:[
{
role:"system",
content:
`Tu es un logiciel de dispatch transport en Suisse.

Tu dois optimiser une tournée de livraison.

Règles:
- départ du dépôt
- minimiser les kilomètres
- prioriser les urgents
- regrouper les villes proches
- répondre uniquement en JSON

format attendu:

{
"order":[id,id,id],
"summary":"texte explicatif"
}`
},

{
role:"user",
content: JSON.stringify({
depot: depot,
orders: orders
})
}

]

})

})

const data = await response.json()

const message = data.choices[0].message.content

const parsed = JSON.parse(message)

res.status(200).json(parsed)

}catch(err){

console.error(err)

res.status(500).json({
error:"AI dispatch failed"
})

}

}
