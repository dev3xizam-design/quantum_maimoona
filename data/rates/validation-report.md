# tax_rates validation against Avalara history

Generated 2026-10-14 13:53 UTC from data/rates/build. Answer key: Avalara Sales Invoices since 2026-07-01, one (state, ZIP5, city) per line below, Avalara rate = latest invoice's combined rate on taxable product lines.

**Overall: 1085 / 1306 (state, ZIP, city) keys match within 0.0001 (83.1%).** With the Oct-1 rate changes counted as expected: 86.5%. With the invoice's ZIP+4 passed to pickRate: 1103 / 1306 (84.5%).

| class | keys | $ impact (taxable x rate diff) |
|---|---:|---:|
| match | 1085 | 0.00 |
| oct1_change | 45 | 26.61 |
| other_row_in_zip | 55 | 64.44 |
| state_rate_differs | 0 | 0.00 |
| unexplained | 118 | 442.67 |
| missing_zip | 3 | 13.28 |

Classes: `oct1_change` = our row's 2026-07-01 rate equals Avalara (a rate changed on 2026-10-01, after these invoices); `other_row_in_zip` = another row of the same ZIP has Avalara's rate (address-level boundary vs our ZIP/city pick); `state_rate_differs` = the state component itself differs; `missing_zip` = no row for the ZIP.

## Per state

| state | keys | match | match % | +ZIP4 | oct1 | other row | state differs | unexplained | missing | biggest $ miss | source |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| AK | 3 | 3 | 100.0% | 3 | 0 | 0 | 0 | 0 | 0 |  | Alaska: no state sales tax (local ARSSTC remote-seller taxes |
| AL | 23 | 0 | 0.0% | 0 | 0 | 0 | 0 | 23 | 0 | 36207 ANNISTON $12.81 | ALDOR taxrates_current.csv (Updated for October 2026), selle |
| AZ | 30 | 0 | 0.0% | 0 | 0 | 1 | 0 | 28 | 1 | 85140 SAN TAN VALLEY $18.16 | ADOR TPT_RATETABLE_ALL_10012026.csv (code 605), Census 2020  |
| CA | 156 | 99 | 63.5% | 99 | 45 | 7 | 0 | 4 | 1 | 91214 LA CRESCENTA $4.72 | CDTFA tax area rates 2026-10-01 (Find Your Tax Rate layer +  |
| CO | 32 | 25 | 78.1% | 23 | 0 | 3 | 0 | 4 | 0 | 80202 DENVER $10.19 | CDOR DR 0800 location codes + DR 1002 July 2026 rates (state |
| CT | 12 | 12 | 100.0% | 12 | 0 | 0 | 0 | 0 | 0 |  | CT DRS: 6.35% statewide, no local sales taxes |
| FL | 99 | 97 | 98.0% | 97 | 0 | 1 | 0 | 0 | 1 | 32572 MILTON $4.34 | Quantum jurisdiction directory (FL DOR rows), Census 2020 ZC |
| HI | 14 | 14 | 100.0% | 14 | 0 | 0 | 0 | 0 | 0 |  | Quantum jurisdiction directory (HI DOR rows), Census 2020 ZC |
| IA | 8 | 2 | 25.0% | 2 | 0 | 2 | 0 | 4 | 0 | 52031 BELLEVUE $2.35 | SST IAR2025Q3MAY30.csv + IAB2026Q4AUG31.csv |
| ID | 10 | 10 | 100.0% | 10 | 0 | 0 | 0 | 0 | 0 |  | Idaho STC: 6% statewide (resort-city taxes do not reach remo |
| IL | 40 | 1 | 2.5% | 1 | 0 | 1 | 0 | 38 | 0 | 60622 CHICAGO $35.74 | IDOR ordmache/ordmacha (destination ROT) |
| IN | 38 | 38 | 100.0% | 38 | 0 | 0 | 0 | 0 | 0 |  | SST INR2008Q4MAY7.csv + INB2005Q1JAN6.csv |
| KS | 9 | 8 | 88.9% | 9 | 0 | 1 | 0 | 0 | 0 | 66202 MISSION $0.66 | SST KSR2026Q4AUG19.csv + KSB2026Q4AUG19.csv |
| KY | 12 | 12 | 100.0% | 12 | 0 | 0 | 0 | 0 | 0 |  | SST KYR2012Q4Aug13.csv + KYB2013Q2MAR13.csv |
| LA | 12 | 0 | 0.0% | 0 | 0 | 0 | 0 | 12 | 0 | 71037 HAUGHTON $8.08 | LA Remote Sellers Commission remittance rates, filing period |
| MA | 45 | 45 | 100.0% | 45 | 0 | 0 | 0 | 0 | 0 |  | MA DOR: 6.25% statewide, no local sales tax on goods |
| MD | 31 | 31 | 100.0% | 31 | 0 | 0 | 0 | 0 | 0 |  | MD Comptroller: 6% statewide, no local sales taxes |
| ME | 2 | 2 | 100.0% | 2 | 0 | 0 | 0 | 0 | 0 |  | Maine Revenue Services: 5.5% statewide |
| MI | 71 | 71 | 100.0% | 71 | 0 | 0 | 0 | 0 | 0 |  | SST MIR2023Q1DEC22.csv + MIB2023Q1DEC15.csv |
| MN | 34 | 28 | 82.4% | 33 | 0 | 5 | 0 | 1 | 0 | 55423 MINNEAPOLIS $24.20 | SST MNR2026Q4AUG18.csv + MNB2026Q4AUG18.csv |
| MO | 16 | 13 | 81.3% | 13 | 0 | 3 | 0 | 0 | 0 | 63138 SAINT LOUIS $5.07 | MO DOR vendor's use tax rate chart |
| MS | 10 | 10 | 100.0% | 10 | 0 | 0 | 0 | 0 | 0 |  | MS DOR: 7% statewide (city special taxes apply to sellers lo |
| NC | 54 | 50 | 92.6% | 52 | 0 | 3 | 0 | 1 | 0 | 28205 CHARLOTTE $1.08 | SST NCR2026Q3APR23.csv + NCB2026Q4AUG19.csv |
| ND | 2 | 2 | 100.0% | 2 | 0 | 0 | 0 | 0 | 0 |  | SST NDR2026Q4AUG14.csv + NDB2026Q4AUG14.csv |
| NE | 1 | 1 | 100.0% | 1 | 0 | 0 | 0 | 0 | 0 |  | SST NER2026Q4AUG21.csv + NEB2026Q4AUG21.csv |
| NJ | 45 | 45 | 100.0% | 45 | 0 | 0 | 0 | 0 | 0 |  | SST NJR2018Q1OCT16.csv + NJB2019Q2MAR27.csv |
| NM | 4 | 4 | 100.0% | 4 | 0 | 0 | 0 | 0 | 0 |  | NM TRD GRT-Rate-Schedule-2026-07-01.xlsx (rates) + Quantum j |
| NV | 13 | 13 | 100.0% | 13 | 0 | 0 | 0 | 0 | 0 |  | SST NVR2025Q4NOV05.csv + NVB2025Q4NOV05.csv |
| NY | 66 | 66 | 100.0% | 66 | 0 | 0 | 0 | 0 | 0 |  | Quantum jurisdiction directory (NY DOR rows), Census 2020 ZC |
| OH | 32 | 30 | 93.8% | 32 | 0 | 2 | 0 | 0 | 0 | 45140 LOVELAND $1.36 | SST OHR2026Q4SEP17.csv + OHB2026Q4SEP17.csv |
| OK | 13 | 10 | 76.9% | 12 | 0 | 3 | 0 | 0 | 0 | 73013 EDMOND $1.05 | SST OKR2026Q4AUG17.csv + OKB2026Q4AUG28.csv |
| PA | 77 | 77 | 100.0% | 77 | 0 | 0 | 0 | 0 | 0 |  | Quantum jurisdiction directory (PA DOR rows), Census 2020 ZC |
| RI | 7 | 7 | 100.0% | 7 | 0 | 0 | 0 | 0 | 0 |  | SST RIR2019Q2MAR27.csv + RIB2019Q2MAR27.csv |
| SC | 19 | 16 | 84.2% | 16 | 0 | 3 | 0 | 0 | 0 | 29644 FOUNTAIN INN $5.70 | us-jurisdictions.csv SC rows (SCDOR ST-389 local tax codes)  |
| SD | 4 | 4 | 100.0% | 4 | 0 | 0 | 0 | 0 | 0 |  | SST SDR2026Q3JUN02.csv + SDB2026Q4SEP08.csv |
| TN | 25 | 23 | 92.0% | 24 | 0 | 1 | 0 | 1 | 0 | 37209 NASHVILLE $0.64 | SST TNR2026Q4AUG21.csv + TNB2026Q4AUG21.csv |
| TX | 105 | 94 | 89.5% | 94 | 0 | 10 | 0 | 1 | 0 | 77380 SPRING $4.26 | TX Comptroller city-rates-Oct26.xlsx (Oct 2026) + spd.php +  |
| VA | 48 | 48 | 100.0% | 48 | 0 | 0 | 0 | 0 | 0 |  | Virginia Tax sales-tax-rates.xlsx (combined state & local ra |
| WA | 33 | 27 | 81.8% | 31 | 0 | 6 | 0 | 0 | 0 | 98604 BATTLE GROUND $1.75 | SST WAR2026Q4AUG27.csv + WAB2026Q4AUG27.csv |
| WI | 46 | 43 | 93.5% | 46 | 0 | 3 | 0 | 0 | 0 | 53219 MILWAUKEE $3.50 | SST WIR2026Q4AUG17.csv + WIB2026Q4AUG17.csv |
| WV | 4 | 3 | 75.0% | 3 | 0 | 0 | 0 | 1 | 0 | 24954 MARLINTON $0.33 | SST WVR2026Q3FEB25.csv + WVB2026Q3APR29.csv |
| WY | 1 | 1 | 100.0% | 1 | 0 | 0 | 0 | 0 | 0 |  | SST WYR2026Q4AUG20.CSV + WYB2026Q4AUG20.csv |

## Every mismatch

| state | zip | city | Avalara | ours | diff | class | picked by | invoices | $ impact | detail |
|---|---|---|---:|---:|---:|---|---|---:|---:|---|
| AL | 36207 | ANNISTON | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 12.81 |  |
| AL | 36567 | ROBERTSDALE | 0.04000 | 0.09000 | 0.05000 | unexplained | city | 2 | 11.24 |  |
| AL | 35094 | LEEDS | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 8.96 |  |
| AL | 36530 | ELBERTA | 0.04000 | 0.11000 | 0.07000 | unexplained | city | 1 | 7.13 |  |
| AL | 35616 | CHEROKEE | 0.04000 | 0.09000 | 0.05000 | unexplained | city | 1 | 6.48 |  |
| AL | 36303 | DOTHAN | 0.04000 | 0.09000 | 0.05000 | unexplained | city | 3 | 6.39 |  |
| AL | 35007 | ALABASTER | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 6.18 |  |
| AL | 35233 | BIRMINGHAM | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 2 | 5.52 |  |
| AL | 35501 | JASPER | 0.04000 | 0.09500 | 0.05500 | unexplained | city | 2 | 5.38 |  |
| AL | 36801 | OPELIKA | 0.04000 | 0.09000 | 0.05000 | unexplained | city | 1 | 5.15 |  |
| AL | 35563 | GUIN | 0.04000 | 0.09000 | 0.05000 | unexplained | city | 1 | 5.00 |  |
| AL | 35901 | GADSDEN | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 2 | 4.26 |  |
| AL | 36203 | OXFORD | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 4.14 |  |
| AL | 35959 | CEDAR BLUFF | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 4.05 |  |
| AL | 35043 | CHELSEA | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 3.36 |  |
| AL | 35180 | WARRIOR | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 3.22 |  |
| AL | 35750 | HAZEL GREEN | 0.04000 | 0.05500 | 0.01500 | unexplained | city | 1 | 3.13 |  |
| AL | 35904 | GADSDEN | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 2.74 |  |
| AL | 35115 | MONTEVALLO | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 2.33 |  |
| AL | 35216 | VESTAVIA HILLS | 0.04000 | 0.10000 | 0.06000 | unexplained | city | 1 | 2.10 |  |
| AL | 36301 | DOTHAN | 0.04000 | 0.09000 | 0.05000 | unexplained | city | 1 | 1.92 |  |
| AL | 36320 | COTTONWOOD | 0.04000 | 0.08000 | 0.04000 | unexplained | city | 1 | 1.16 |  |
| AL | 35111 | MC CALLA | 0.04000 | 0.06000 | 0.02000 | unexplained | city | 1 | 0.65 |  |
| AZ | 85140 | SAN TAN VALLEY | 0.05600 | 0.08950 | 0.03350 | unexplained | city | 5 | 18.16 |  |
| AZ | 85602 | BENSON | 0.05600 | 0.10100 | 0.04500 | unexplained | city | 1 | 6.44 |  |
| AZ | 85144 | QUEEN CREEK | 0.05600 | - | - | missing_zip | - | 1 | 5.37 |  |
| AZ | 85340 | LITCHFIELD PARK | 0.05600 | 0.09100 | 0.03500 | unexplained | city | 1 | 4.27 |  |
| AZ | 85143 | SAN TAN VALLEY | 0.05600 | 0.08950 | 0.03350 | unexplained | city | 1 | 4.22 |  |
| AZ | 85643 | WILLCOX | 0.05600 | 0.09600 | 0.04000 | unexplained | city | 1 | 3.40 |  |
| AZ | 86046 | WILLIAMS | 0.05600 | 0.10400 | 0.04800 | unexplained | city | 1 | 3.34 |  |
| AZ | 85255 | SCOTTSDALE | 0.07100 | 0.08000 | 0.00900 | unexplained | city | 2 | 3.08 |  |
| AZ | 85323 | AVONDALE | 0.07100 | 0.08800 | 0.01700 | unexplained | city | 1 | 2.62 |  |
| AZ | 85251 | SCOTTSDALE | 0.07100 | 0.08000 | 0.00900 | unexplained | city | 6 | 2.60 |  |
| AZ | 86409 | KINGMAN | 0.05600 | 0.08600 | 0.03000 | other_row_in_zip | city | 1 | 1.54 | row New Kingman-Butler/Mohave |
| AZ | 85305 | GLENDALE | 0.05600 | 0.09200 | 0.03600 | unexplained | city | 1 | 1.37 |  |
| AZ | 85741 | TUCSON | 0.05600 | 0.08700 | 0.03100 | unexplained | city | 1 | 1.36 |  |
| AZ | 85045 | PHOENIX | 0.08400 | 0.09100 | 0.00700 | unexplained | city | 4 | 1.18 |  |
| AZ | 85120 | APACHE JUNCTION | 0.08000 | 0.09100 | 0.01100 | unexplained | city | 2 | 0.88 |  |
| AZ | 85396 | BUCKEYE | 0.08600 | 0.09300 | 0.00700 | unexplained | city | 1 | 0.86 |  |
| AZ | 85742 | TUCSON | 0.08100 | 0.06100 | -0.02000 | unexplained | primary | 1 | 0.84 |  |
| AZ | 85539 | MIAMI | 0.08100 | 0.09100 | 0.01000 | unexplained | city | 1 | 0.79 |  |
| AZ | 85204 | MESA | 0.07600 | 0.08300 | 0.00700 | unexplained | city | 3 | 0.76 |  |
| AZ | 85335 | EL MIRAGE | 0.08600 | 0.09300 | 0.00700 | unexplained | city | 1 | 0.72 |  |
| AZ | 85086 | PHOENIX | 0.08400 | 0.09100 | 0.00700 | unexplained | city | 1 | 0.70 |  |
| AZ | 85282 | TEMPE | 0.07400 | 0.08100 | 0.00700 | unexplained | city | 1 | 0.69 |  |
| AZ | 85310 | GLENDALE | 0.08400 | 0.09200 | 0.00800 | unexplained | city | 1 | 0.68 |  |
| AZ | 85614 | GREEN VALLEY | 0.05600 | 0.06100 | 0.00500 | unexplained | city | 1 | 0.54 |  |
| AZ | 85024 | PHOENIX | 0.08400 | 0.09100 | 0.00700 | unexplained | city | 1 | 0.40 |  |
| AZ | 86327 | PRESCOTT VALLEY | 0.08430 | 0.09180 | 0.00750 | unexplained | city | 1 | 0.40 |  |
| AZ | 85379 | SURPRISE | 0.08400 | 0.09100 | 0.00700 | unexplained | city | 1 | 0.29 |  |
| AZ | 85142 | QUEEN CREEK | 0.07850 | 0.08550 | 0.00700 | unexplained | city | 1 | 0.27 |  |
| AZ | 85233 | GILBERT | 0.07600 | 0.08300 | 0.00700 | unexplained | city | 1 | 0.25 |  |
| AZ | 85254 | SCOTTSDALE | 0.08400 | 0.08000 | -0.00400 | unexplained | city | 1 | 0.22 |  |
| CA | 91214 | LA CRESCENTA | 0.09750 | 0.11000 | 0.01250 | unexplained | primary | 3 | 4.72 |  |
| CA | 95829 | SACRAMENTO | 0.07750 | 0.08750 | 0.01000 | other_row_in_zip | city | 1 | 3.81 | row Vineyard/Sacramento |
| CA | 92822 | BREA | 0.07750 | - | - | missing_zip | - | 1 | 3.56 |  |
| CA | 90713 | LAKEWOOD | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 5 | 2.19 |  |
| CA | 91106 | PASADENA | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 2 | 1.84 |  |
| CA | 91024 | SIERRA MADRE | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 2 | 1.64 |  |
| CA | 91356 | TARZANA | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 2 | 1.57 |  |
| CA | 91384 | CASTAIC | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 3 | 1.50 |  |
| CA | 90247 | GARDENA | 0.09750 | 0.11250 | 0.01500 | unexplained | city | 1 | 1.48 |  |
| CA | 91791 | WEST COVINA | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 3 | 1.29 |  |
| CA | 91722 | COVINA | 0.09750 | 0.11250 | 0.01500 | unexplained | city | 2 | 1.05 |  |
| CA | 91748 | ROWLAND HEIGHTS | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 1.02 |  |
| CA | 90401 | SANTA MONICA | 0.10750 | 0.11250 | 0.00500 | oct1_change | city | 1 | 1.01 |  |
| CA | 90274 | PALOS VERDES ESTATES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 2 | 1.00 |  |
| CA | 90212 | BEVERLY HILLS | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.98 |  |
| CA | 90803 | LONG BEACH | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 2 | 0.94 |  |
| CA | 91606 | NORTH HOLLYWOOD | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 2 | 0.80 |  |
| CA | 95476 | SONOMA | 0.09250 | 0.10250 | 0.01000 | other_row_in_zip | city | 2 | 0.74 | row (no city)/Sonoma |
| CA | 91335 | RESEDA | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 2 | 0.70 |  |
| CA | 91302 | CALABASAS | 0.09750 | 0.11250 | 0.01500 | oct1_change | city | 1 | 0.69 |  |
| CA | 91344 | GRANADA HILLS | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.67 |  |
| CA | 90606 | WHITTIER | 0.09750 | 0.11000 | 0.01250 | unexplained | city | 1 | 0.67 |  |
| CA | 90290 | TOPANGA | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 2 | 0.65 |  |
| CA | 93245 | LEMOORE | 0.07250 | 0.08250 | 0.01000 | other_row_in_zip | city | 1 | 0.62 | row Lemoore Station/Kings |
| CA | 90019 | LOS ANGELES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 2 | 0.54 |  |
| CA | 94952 | PETALUMA | 0.09250 | 0.10250 | 0.01000 | other_row_in_zip | city | 1 | 0.52 | row (no city)/Sonoma |
| CA | 91205 | GLENDALE | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 1 | 0.50 |  |
| CA | 90067 | LOS ANGELES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.50 |  |
| CA | 90254 | HERMOSA BEACH | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.50 |  |
| CA | 91602 | TOLUCA LAKE | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.50 |  |
| CA | 91316 | ENCINO | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 2 | 0.46 |  |
| CA | 90024 | LOS ANGELES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.40 |  |
| CA | 93536 | LANCASTER | 0.11250 | 0.11750 | 0.00500 | oct1_change | city | 1 | 0.39 |  |
| CA | 91311 | CHATSWORTH | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.34 |  |
| CA | 90815 | LONG BEACH | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 2 | 0.30 |  |
| CA | 90017 | LOS ANGELES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.28 |  |
| CA | 92021 | EL CAJON | 0.07750 | 0.08250 | 0.00500 | other_row_in_zip | city | 1 | 0.28 | row Bostonia/San Diego |
| CA | 90005 | LOS ANGELES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.27 |  |
| CA | 90277 | REDONDO BEACH | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.26 |  |
| CA | 90715 | LAKEWOOD | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 1 | 0.23 |  |
| CA | 94019 | HALF MOON BAY | 0.09375 | 0.09875 | 0.00500 | other_row_in_zip | city | 1 | 0.22 | row El Granada/San Mateo |
| CA | 91351 | CANYON COUNTRY | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.22 |  |
| CA | 91405 | VAN NUYS | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.22 |  |
| CA | 91355 | SANTA CLARITA | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.19 |  |
| CA | 90038 | LOS ANGELES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.18 |  |
| CA | 90232 | CULVER CITY | 0.10750 | 0.11250 | 0.00500 | oct1_change | city | 1 | 0.18 |  |
| CA | 90274 | PALOS VERDES PENINSULA | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.18 |  |
| CA | 91325 | NORTHRIDGE | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.17 |  |
| CA | 91342 | SYLMAR | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.17 |  |
| CA | 90732 | SAN PEDRO | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.16 |  |
| CA | 90731 | SAN PEDRO | 0.09750 | 0.10250 | 0.00500 | oct1_change | primary | 1 | 0.16 |  |
| CA | 91702 | AZUSA | 0.10750 | 0.11250 | 0.00500 | oct1_change | city | 1 | 0.16 |  |
| CA | 90211 | BEVERLY HILLS | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.16 |  |
| CA | 91754 | MONTEREY PARK | 0.10500 | 0.11000 | 0.00500 | oct1_change | city | 1 | 0.16 |  |
| CA | 90703 | CERRITOS | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.15 |  |
| CA | 90274 | ROLLING HILLS ESTATES | 0.09750 | 0.10250 | 0.00500 | oct1_change | city | 1 | 0.15 |  |
| CA | 95062 | SANTA CRUZ | 0.09500 | 0.09750 | 0.00250 | other_row_in_zip | city | 1 | 0.11 | row Live Oak/Santa Cruz |
| CO | 80202 | DENVER | 0.13900 | 0.04000 | -0.09900 | unexplained | city | 1 | 10.19 |  |
| CO | 80465 | MORRISON | 0.05000 | 0.08250 | 0.03250 | unexplained | city | 3 | 5.80 |  |
| CO | 81007 | PUEBLO | 0.05900 | 0.03900 | -0.02000 | other_row_in_zip | city | 1 | 2.04 | row Pueblo West/Pueblo |
| CO | 80123 | LITTLETON | 0.05000 | 0.04250 | -0.00750 | unexplained | city | 1 | 1.32 |  |
| CO | 80134 | PARKER | 0.04000 | 0.05000 | 0.01000 | other_row_in_zip | city | 1 | 1.00 | row Castle Pines/Douglas |
| CO | 80129 | HIGHLANDS RANCH | 0.04000 | 0.05000 | 0.01000 | unexplained | city | 1 | 0.85 |  |
| CO | 80831 | PEYTON | 0.03900 | 0.05130 | 0.01230 | other_row_in_zip | city | 2 | 0.84 | row (no city)/Elbert |
| FL | 32572 | MILTON | 0.07000 | - | - | missing_zip | - | 1 | 4.34 |  |
| FL | 32703 | APOPKA | 0.07000 | 0.06500 | -0.00500 | other_row_in_zip | city | 2 | 1.10 | row Forest City/Seminole |
| IA | 52031 | BELLEVUE | 0.06000 | 0.07000 | 0.01000 | unexplained | city | 5 | 2.35 |  |
| IA | 52803 | DAVENPORT | 0.06000 | 0.07000 | 0.01000 | unexplained | city | 1 | 1.30 |  |
| IA | 50035 | BONDURANT | 0.06000 | 0.07000 | 0.01000 | other_row_in_zip | city | 1 | 1.30 | row (no city)/ |
| IA | 52761 | MUSCATINE | 0.06000 | 0.07000 | 0.01000 | unexplained | city | 1 | 1.00 |  |
| IA | 52755 | LONE TREE | 0.06000 | 0.07000 | 0.01000 | other_row_in_zip | city | 1 | 0.74 | row (no city)/ |
| IA | 52732 | CLINTON | 0.06000 | 0.07000 | 0.01000 | unexplained | city | 1 | 0.32 |  |
| IL | 60622 | CHICAGO | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 2 | 35.74 |  |
| IL | 60067 | PALATINE | 0.06250 | 0.10250 | 0.04000 | unexplained | city | 2 | 12.12 |  |
| IL | 60654 | CHICAGO | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 3 | 10.15 |  |
| IL | 60526 | LA GRANGE PARK | 0.06250 | 0.09250 | 0.03000 | unexplained | city | 3 | 9.19 |  |
| IL | 60631 | CHICAGO | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 1 | 7.65 |  |
| IL | 60130 | FOREST PARK | 0.06250 | 0.10250 | 0.04000 | unexplained | city | 2 | 5.90 |  |
| IL | 60462 | ORLAND PARK | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 1 | 5.39 |  |
| IL | 60451 | NEW LENOX | 0.06250 | 0.09750 | 0.03500 | unexplained | city | 1 | 4.90 |  |
| IL | 60661 | CHICAGO | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 1 | 4.25 |  |
| IL | 60448 | MOKENA | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 2 | 3.78 |  |
| IL | 60561 | DARIEN | 0.06250 | 0.08500 | 0.02250 | unexplained | city | 2 | 3.78 |  |
| IL | 61832 | DANVILLE | 0.06250 | 0.09250 | 0.03000 | unexplained | city | 2 | 3.74 |  |
| IL | 61201 | ROCK ISLAND | 0.06250 | 0.08500 | 0.02250 | unexplained | city | 2 | 3.46 |  |
| IL | 62864 | MOUNT VERNON | 0.06250 | 0.09500 | 0.03250 | unexplained | city | 1 | 3.25 |  |
| IL | 60148 | LOMBARD | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 3 | 3.22 |  |
| IL | 60611 | CHICAGO | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 2 | 3.14 |  |
| IL | 60014 | CRYSTAL LAKE | 0.06250 | 0.08750 | 0.02500 | unexplained | city | 2 | 3.13 |  |
| IL | 62521 | DECATUR | 0.06250 | 0.09250 | 0.03000 | unexplained | city | 1 | 3.09 |  |
| IL | 60016 | DES PLAINES | 0.06250 | 0.10250 | 0.04000 | unexplained | city | 1 | 2.91 |  |
| IL | 62959 | MARION | 0.06250 | 0.09500 | 0.03250 | unexplained | city | 1 | 2.76 |  |
| IL | 60123 | ELGIN | 0.06250 | 0.08750 | 0.02500 | unexplained | city | 2 | 2.75 |  |
| IL | 60487 | TINLEY PARK | 0.06250 | 0.10250 | 0.04000 | unexplained | city | 1 | 2.71 |  |
| IL | 60441 | LOCKPORT | 0.06250 | 0.09250 | 0.03000 | unexplained | city | 1 | 2.70 |  |
| IL | 60714 | NILES | 0.06250 | 0.10500 | 0.04250 | unexplained | city | 1 | 2.55 |  |
| IL | 61742 | GOODFIELD | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 2.30 |  |
| IL | 60101 | ADDISON | 0.06250 | 0.09000 | 0.02750 | unexplained | city | 2 | 2.11 |  |
| IL | 60177 | SOUTH ELGIN | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 2.00 |  |
| IL | 60304 | OAK PARK | 0.06250 | 0.10250 | 0.04000 | unexplained | city | 1 | 1.56 |  |
| IL | 60002 | ANTIOCH | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 1.52 |  |
| IL | 60181 | VILLA PARK | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 1.44 |  |
| IL | 61559 | PRINCEVILLE | 0.06250 | 0.07250 | 0.01000 | unexplained | city | 2 | 1.35 |  |
| IL | 60440 | BOLINGBROOK | 0.06250 | 0.08750 | 0.02500 | unexplained | city | 1 | 1.15 |  |
| IL | 60510 | BATAVIA | 0.06250 | 0.08750 | 0.02500 | unexplained | city | 1 | 1.12 |  |
| IL | 60015 | DEERFIELD | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 1.08 |  |
| IL | 60110 | CARPENTERSVILLE | 0.06250 | 0.09250 | 0.03000 | unexplained | city | 1 | 1.06 |  |
| IL | 62675 | PETERSBURG | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 0.96 |  |
| IL | 62258 | MASCOUTAH | 0.06250 | 0.07600 | 0.01350 | unexplained | city | 1 | 0.89 |  |
| IL | 60189 | WHEATON | 0.06250 | 0.08500 | 0.02250 | unexplained | city | 1 | 0.85 |  |
| IL | 60531 | LELAND | 0.06250 | 0.06500 | 0.00250 | other_row_in_zip | city | 2 | 0.16 | row (no city)/DeKalb |
| KS | 66202 | MISSION | 0.09350 | 0.09725 | 0.00375 | other_row_in_zip | city | 1 | 0.66 | row Overland Park/Johnson |
| LA | 71037 | HAUGHTON | 0.05000 | 0.10250 | 0.05250 | unexplained | city | 2 | 8.08 |  |
| LA | 70115 | NEW ORLEANS | 0.05000 | 0.10000 | 0.05000 | unexplained | city | 1 | 6.50 |  |
| LA | 70501 | LAFAYETTE | 0.05000 | 0.09000 | 0.04000 | unexplained | city | 1 | 6.32 |  |
| LA | 71350 | MANSURA | 0.05000 | 0.10250 | 0.05250 | unexplained | city | 1 | 5.46 |  |
| LA | 71055 | MINDEN | 0.05000 | 0.10500 | 0.05500 | unexplained | city | 1 | 3.85 |  |
| LA | 70072 | MARRERO | 0.05000 | 0.09750 | 0.04750 | unexplained | city | 1 | 2.70 |  |
| LA | 71292 | WEST MONROE | 0.05000 | 0.10990 | 0.05990 | unexplained | city | 1 | 2.60 |  |
| LA | 70435 | COVINGTON | 0.05000 | 0.09250 | 0.04250 | unexplained | city | 1 | 2.17 |  |
| LA | 71360 | PINEVILLE | 0.05000 | 0.10500 | 0.05500 | unexplained | city | 1 | 1.98 |  |
| LA | 70560 | NEW IBERIA | 0.05000 | 0.10500 | 0.05500 | unexplained | city | 1 | 1.86 |  |
| LA | 70706 | DENHAM SPRINGS | 0.05000 | 0.09000 | 0.04000 | unexplained | primary | 1 | 1.68 |  |
| LA | 70433 | COVINGTON | 0.05000 | 0.09250 | 0.04250 | unexplained | city | 1 | 1.65 |  |
| MN | 55423 | MINNEAPOLIS | 0.23875 | 0.09025 | -0.14850 | unexplained | city | 2 (Avalara rate varied) | 24.20 |  |
| MN | 55073 | SCANDIA | 0.08375 | 0.07375 | -0.01000 | other_row_in_zip | primary | 1 | 0.99 | row (no city)/Washington |
| MN | 55110 | SAINT PAUL | 0.08125 | 0.08375 | 0.00250 | other_row_in_zip | primary | 1 | 0.67 | row (no city)/Anoka |
| MN | 55108 | SAINT PAUL | 0.08375 | 0.09875 | 0.01500 | other_row_in_zip | city | 1 | 0.47 | row (no city)/Ramsey |
| MN | 55362 | MONTICELLO | 0.07375 | 0.07875 | 0.00500 | other_row_in_zip | city | 1 | 0.42 | row (no city)/Wright |
| MN | 55375 | SAINT BONIFACIUS | 0.08525 | 0.08375 | -0.00150 | other_row_in_zip | primary | 4 | 0.24 | row (no city)/Hennepin |
| MO | 63138 | SAINT LOUIS | 0.04225 | 0.09013 | 0.04788 | other_row_in_zip | city | 1 | 5.07 | row Spanish Lake/St Louis County |
| MO | 63303 | SAINT CHARLES | 0.05950 | 0.07950 | 0.02000 | other_row_in_zip | city | 1 | 1.69 | row (no city)/St Charles County |
| MO | 65583 | WAYNESVILLE | 0.04225 | 0.06475 | 0.02250 | other_row_in_zip | city | 1 | 0.88 | row (no city)/Pulaski County |
| NC | 28205 | CHARLOTTE | 0.06250 | 0.08250 | 0.02000 | unexplained | city | 1 | 1.08 |  |
| NC | 27592 | WILLOW SPRING | 0.06750 | 0.07250 | 0.00500 | other_row_in_zip | city | 3 | 0.92 | row WILLOW SPRING/Johnston |
| NC | 28086 | KINGS MOUNTAIN | 0.07000 | 0.06750 | -0.00250 | other_row_in_zip | city | 3 | 0.70 | row Kings Mountain/Gaston |
| NC | 28602 | HICKORY | 0.06750 | 0.07000 | 0.00250 | other_row_in_zip | city | 1 | 0.10 | row HICKORY/Burke |
| OH | 45140 | LOVELAND | 0.07800 | 0.06750 | -0.01050 | other_row_in_zip | city | 1 | 1.36 | row LOVELAND/Hamilton |
| OH | 44460 | SALEM | 0.07500 | 0.07250 | -0.00250 | other_row_in_zip | city | 2 | 0.98 | row SALEM/Mahoning |
| OK | 73013 | EDMOND | 0.08625 | 0.08250 | -0.00375 | other_row_in_zip | city | 3 | 1.05 | row Oklahoma City/Oklahoma |
| OK | 73012 | EDMOND | 0.08625 | 0.08250 | -0.00375 | other_row_in_zip | city | 1 | 0.48 | row Oklahoma City/Oklahoma |
| OK | 73099 | YUKON | 0.08975 | 0.08850 | -0.00125 | other_row_in_zip | city | 1 | 0.08 | row Oklahoma City/Canadian |
| SC | 29644 | FOUNTAIN INN | 0.08000 | 0.06000 | -0.02000 | other_row_in_zip | city | 1 | 5.70 | row (no city)/Laurens |
| SC | 29673 | PIEDMONT | 0.06000 | 0.07000 | 0.01000 | other_row_in_zip | city | 3 (Avalara rate varied) | 1.41 | row (no city)/Greenville |
| SC | 29651 | GREER | 0.06000 | 0.07000 | 0.01000 | other_row_in_zip | city | 3 (Avalara rate varied) | 1.32 | row (no city)/Greenville |
| TN | 37209 | NASHVILLE | 0.07500 | 0.09750 | 0.02250 | unexplained | city | 1 | 0.64 |  |
| TN | 37660 | KINGSPORT | 0.09500 | 0.09250 | -0.00250 | other_row_in_zip | city | 1 | 0.25 | row KINGSPORT/ |
| TX | 77380 | SPRING | 0.07250 | 0.06250 | -0.01000 | unexplained | primary | 1 | 4.26 |  |
| TX | 76247 | JUSTIN | 0.06250 | 0.08250 | 0.02000 | other_row_in_zip | city | 1 | 2.00 | row (no city)/Denton |
| TX | 77459 | MISSOURI CITY | 0.06250 | 0.08250 | 0.02000 | other_row_in_zip | city | 2 | 1.93 | row Sienna/Fort Bend |
| TX | 76557 | MOODY | 0.06750 | 0.08250 | 0.01500 | other_row_in_zip | city | 1 | 1.87 | row (no city)/McLennan |
| TX | 76073 | PARADISE | 0.06750 | 0.08250 | 0.01500 | other_row_in_zip | city | 1 | 1.69 | row (no city)/Wise |
| TX | 77493 | KATY | 0.07250 | 0.08250 | 0.01000 | other_row_in_zip | city | 1 | 1.50 | row (no city)/Harris |
| TX | 77429 | CYPRESS | 0.08250 | 0.07250 | -0.01000 | other_row_in_zip | primary | 1 | 1.29 | row Houston/Harris |
| TX | 75650 | HALLSVILLE | 0.06250 | 0.08250 | 0.02000 | other_row_in_zip | city | 1 | 1.08 | row (no city)/Harrison |
| TX | 78669 | SPICEWOOD | 0.08250 | 0.07250 | -0.01000 | other_row_in_zip | primary | 1 | 0.90 | row Briarcliff/Travis |
| TX | 78619 | DRIFTWOOD | 0.08250 | 0.06750 | -0.01500 | other_row_in_zip | city | 1 | 0.81 | row Dripping Springs/Hays |
| TX | 75009 | CELINA | 0.07750 | 0.08250 | 0.00500 | other_row_in_zip | city | 1 | 0.75 | row Weston/Collin |
| WA | 98604 | BATTLE GROUND | 0.08000 | 0.08900 | 0.00900 | other_row_in_zip | city | 2 | 1.75 | row BATTLE GROUND/Clark |
| WA | 98502 | OLYMPIA | 0.09600 | 0.10000 | 0.00400 | other_row_in_zip | city | 2 | 1.08 | row OLYMPIA/Thurston +4 1541-1541 |
| WA | 98292 | STANWOOD | 0.09300 | 0.07900 | -0.01400 | other_row_in_zip | city | 1 | 1.05 | row Stanwood/ +4 0015-0027 |
| WA | 98632 | LONGVIEW | 0.07700 | 0.08200 | 0.00500 | other_row_in_zip | city | 1 | 0.65 | row LONGVIEW/Cowlitz |
| WA | 98626 | KELSO | 0.08100 | 0.07700 | -0.00400 | other_row_in_zip | city | 1 | 0.13 | row Kelso/ |
| WA | 98611 | CASTLE ROCK | 0.07900 | 0.07700 | -0.00200 | other_row_in_zip | city | 1 | 0.09 | row Castle Rock/ |
| WI | 53219 | MILWAUKEE | 0.05900 | 0.07900 | 0.02000 | other_row_in_zip | city | 1 | 3.50 | row West Allis/Milwaukee |
| WI | 53150 | MUSKEGO | 0.05000 | 0.05500 | 0.00500 | other_row_in_zip | city | 2 | 1.69 | row (no city)/ |
| WI | 53042 | KIEL | 0.05500 | 0.05000 | -0.00500 | other_row_in_zip | city | 1 | 0.23 | row Kiel/Manitowoc |
| WV | 24954 | MARLINTON | 0.06000 | 0.07000 | 0.01000 | unexplained | city | 1 | 0.33 |  |
