export default async function handler(req,res){

const { depot, orders } = req.body

const sorted = [...orders].sort((a,b) => {
  if(a.priority === "urgent" && b.priority !== "urgent") return -1
  if(a.priority !== "urgent" && b.priority === "urgent") return 1
  return String(a.delivery_city).localeCompare(String(b.delivery_city))
})

res.status(200).json({
summary:
`Dépôt : ${depot}
Ordre proposé :
${sorted.map((o,i)=>`${i+1}. ${o.delivery_city} - ${o.client}`).join("\n")}`,
order: sorted.map(o => o.id)
})

}
