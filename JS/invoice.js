function generateInvoice(order){

const doc = new jspdf.jsPDF()

doc.text("Léman-Courses",20,20)
doc.text("Facture transport",20,40)

doc.text("Commande : "+order.order_number,20,60)

doc.text("Montant : CHF "+order.price,20,80)

doc.save("facture_"+order.order_number+".pdf")

}
