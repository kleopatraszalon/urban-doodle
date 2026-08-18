# Kleoshop ↔ eMAG Bridge

Önálló, Renderre deployolható Shoprenter ↔ eMAG Marketplace HU integráció.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fkleopatraszalon%2Furban-doodle)

## Mire képes az első stabil verzió?

- Shoprenter API kapcsolat tesztelése (OAuth2 Client Credentials; opcionális legacy Basic Auth)
- Shoprenter termékek lekérése
- eMAG HU API kapcsolat tesztelése
- eMAG ajánlatok és rendelések lekérése
- Shoprenter termékek eMAG katalógushoz párosítása EAN/GTIN alapján
- legfeljebb 5 termékes biztonságos próbaszinkron
- új eMAG-ajánlat létrehozása meglévő eMAG katalógustermékhez EAN-párosítás alapján
- ár, készlet, aktív/inaktív állapot és ÁFA átadása az eMAG `product_offer/save` végpontjára
- meglévő eMAG-ajánlatok védelme: explicit azonosító-párosítás nélkül nem írja őket felül
- eMAG order/cancel/return callback végpontok
- admin felület `/` alatt, `ADMIN_TOKEN` védelemmel

## Fontos

A normál Shoprenter admin- és eMAG webes belépési jelszavakat **nem** szabad a kódba tenni. Shoprenter oldalon API kliens (`client_id`, `client_secret`), eMAG oldalon API jogosultságú felhasználó szükséges.

Az eMAG API IP-szűrést alkalmazhat az API-hozzáférésnél. Az eMAG fiók technikai beállításainál engedélyezni kell annak a Render szolgáltatásnak a kimenő IP-jét/IP-tartományát, ahonnan az API-hívások érkeznek.

## Render

A repo tartalmaz `render.yaml` Blueprintet. A szolgáltatás neve: `kleoshop-emag-bridge`.

Kötelező környezeti változók:

- `SHOPRENTER_SHOP_NAME`
- `SHOPRENTER_CLIENT_ID`
- `SHOPRENTER_CLIENT_SECRET`
- `EMAG_API_USERNAME`
- `EMAG_API_PASSWORD`

A Blueprint automatikusan generál `ADMIN_TOKEN` értéket.

## Callback URL-ek

Ha a Render URL például `https://kleoshop-emag-bridge.onrender.com`, akkor:

- Order: `https://kleoshop-emag-bridge.onrender.com/api/callback/emag/order`
- Order cancellation: `https://kleoshop-emag-bridge.onrender.com/api/callback/emag/order-cancel`
- Return: `https://kleoshop-emag-bridge.onrender.com/api/callback/emag/return`

## Biztonság

Az éles sync végpont egyszerre maximum 5 terméket enged, és `confirm: "SYNC5"` megerősítést követel meg. Teljes katalógusszinkron csak az első 5 termék sikeres eMAG validációja után javasolt.
