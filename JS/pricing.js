function calculatePrice(p,data){

let price = p.base_fee

price += data.km * p.price_per_km

if(data.type==="carton")
price += p.package_carton

if(data.type==="palette")
price += p.package_palette

if(data.volume)
price += data.volume * p.price_m3

if(data.weight>10)
price += p.weight_10

if(data.urgent)
price *= p.urgent_multiplier

return Math.round(price*100)/100
}
