function calculatePrice(pricing, data){

let price = pricing.base_fee

price += data.km * pricing.price_per_km

if(data.type === "carton")
price += pricing.package_carton

if(data.type === "palette")
price += pricing.package_palette

if(data.volume)
price += data.volume * pricing.price_m3

if(data.weight > 10)
price += pricing.weight_10

if(data.urgent)
price *= pricing.urgent_multiplier

return Math.round(price*100)/100
}
