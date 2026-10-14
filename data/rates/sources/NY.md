# NY - sales tax rate sources

As of: **2026-10-01** (rates in force on the first day of 2026-Q4). Checked 2026-10-14.

## Sources

- NYS DTF Publication 718 (2/25) "Effective March 1, 2025" (saved: data/rates/raw/NY/pub718-2025-03.pdf) and Publication 718-A (12/25) (saved: data/rates/raw/NY/pub718a-2025-12.pdf). Every directory row was compared to Pub 718: all 62 counties / 19 cities / NYC match. 718-A (12/25) lists no change effective in 2026; latest change is Suffolk 4 3/8% local from 2025-03-01. MCTD 3/8% applies in the 12 counties marked * in Pub 718.
- Shape: 4% + county/city + MCTD. Census 2020 ZCTA pieces map ZIPs to counties/cities.

## Validation against Avalara (Sales Invoices since 2026-07-01)

66 / 66 (state, ZIP, city) keys match (100.0%); 66 / 66 with the invoice's ZIP+4.
