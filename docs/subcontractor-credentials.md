# Subcontractor account credentials

Run once to create accounts:

```bash
cd /Users/dukediamond/fireside
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/create-subcontractors.js
```

Get your service role key from: **Supabase Dashboard → Settings → API → service_role**.

---

## Credentials (passwords: Fireside01 … Fireside15)

| # | Email | Password | Name | Business | Trade |
|---|-------|----------|------|----------|-------|
| 1 | office2@caulerconstruction.com | Fireside01 | Rex Caulder | Caulder Construction | Excavation |
| 2 | cullen@metrocast.net | Fireside02 | Andrew Cullen | Cullen Concrete | Foundation |
| 3 | degracecontracting@yahoo.com | Fireside03 | James DeGrace | DeGrace Contracting | Foundation |
| 4 | mattking024@yahoo.com | Fireside04 | Matt King | King Foundation Sealing | Foundation Sealing |
| 5 | customhomebuildinginc@outlook.com | Fireside05 | Cleber De Melo | Custom Home Building | Framing |
| 6 | saviooivasinar05261998@gmail.com | Fireside06 | Savio Andres | SAM New Construction | Siding |
| 7 | brandon@bdmplumbingmechanicals.com | Fireside07 | Brandon Murray | BDM Plumbing | Plumbing |
| 8 | office@jjheatac.com | Fireside08 | Joey Silva | J&J HVAC | HVAC |
| 9 | tom@sabournelectric.com | Fireside09 | Tom Sabourn | Sabourn Electric | Electrical |
| 10 | rick@completeav.ur | Fireside10 | Rick Hartley | Complete AV | IT |
| 11 | jacob@vineyardhome.com | Fireside11 | Jake Avakian | Vineyard Home | IT |
| 12 | marcopierrondi@gmail.com | Fireside12 | Marco Pierrondi | Cape Cod Counterworks | Countertops |
| 13 | bbuffington@graniteglass.com | Fireside13 | Brent Buffington | Granite State Glass | Shower Glass Doors |
| 14 | silvermassgeneralflooring@gmail.com | Fireside14 | Junio Silveira | Silver Mass General Flooring | Flooring |
| 15 | nleighton@overheaddooroptions.com | Fireside15 | Nick Leighton | Overhead Door Options | Garage Doors |

All accounts are created with **role: Subcontractor** and **status: active** (no approval needed). After running the script, users can sign in with the email and password above.
