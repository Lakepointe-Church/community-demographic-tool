import { BOUNDARY_CHANGED } from './zips'

const CENSUS_BASE = 'https://api.census.gov/data'

// B05006 birthplace proxy — Muslim-majority country origins (excludes Iran, Lebanon, Israel, India)
// Full rationale: data/proxy-countries.json
const PROXY_BORN_VARS = [
  'B05006_057E','B05006_058E','B05006_064E','B05006_066E', // Afghanistan, Bangladesh, Pakistan, Uzbekistan
  'B05006_083E','B05006_085E','B05006_086E','B05006_088E', // Iraq*, Jordan, Kuwait, Saudi Arabia
  'B05006_089E','B05006_090E','B05006_091E','B05006_092E', // Syria*, Turkey, UAE, Yemen
  'B05006_093E',                                            // Other Western Asia (Bahrain, Qatar, Oman, W. Bank/Gaza)
  'B05006_100E',                                            // Somalia
  'B05006_111E','B05006_112E','B05006_113E','B05006_114E', // Algeria, Egypt*, Morocco, Sudan
  'B05006_115E',                                            // Other Northern Africa (Libya, Tunisia)
  'B05006_125E',                                            // Senegal
]

// C16001 language proxy — Arabic only (ZCTA-level; B16001 is tract/county only)
// C16001_033E = Total Arabic speakers (all English proficiency levels)
// Urdu, Bengali, Somali are not separately listed in C16001 at ZCTA level
const PROXY_LANG_VARS = [
  'C16001_033E', // Arabic speakers (household language, all ages 5+)
]

const VARS = [
  'B01001_001E', // Total population
  'B19013_001E', // Median household income
  'B25077_001E', // Median home value
  'B11001_001E', // Total households
  'B23025_005E', // Unemployed
  'B23025_002E', // Labor force
  // Education (B15003)
  'B15003_001E', 'B15003_017E', 'B15003_018E', 'B15003_019E',
  'B15003_020E', 'B15003_021E', 'B15003_022E', 'B15003_023E',
  'B15003_024E', 'B15003_025E',
  // Race/ethnicity (B03002)
  'B03002_001E', 'B03002_003E', 'B03002_004E', 'B03002_006E', 'B03002_012E',
  // Household composition
  'B11005_002E', // HH with own children under 18
  'B25010_001E', // Average household size
  'B11001_003E', // Married-couple family households
  'B11001_008E', // Nonfamily, living alone
  'B11003_003E', // Married-couple with own children under 18
  // Income brackets (B19001)
  'B19001_001E',
  'B19001_002E', 'B19001_003E', 'B19001_004E', 'B19001_005E',
  'B19001_006E', 'B19001_007E', 'B19001_008E', 'B19001_009E', 'B19001_010E',
  'B19001_011E', 'B19001_012E', 'B19001_013E',
  'B19001_014E', 'B19001_015E', 'B19001_016E', 'B19001_017E',
].join(',')

// YFI/WFI inputs — separate call
const YFI_WFI_VARS = [
  // Fertility signal (B13016)
  'B13016_001E', // Women 15-50 total
  'B13016_002E', // Women 15-50 who had a birth in past 12 months
  // Dual-earner families (B23007)
  'B23007_001E', // Total families
  'B23007_004E', // Married-couple with children — husband & wife both in labor force
  'B23007_014E', // Married-couple without children — husband & wife both in labor force
  // Commute burden (B08303)
  'B08303_001E', // Total workers 16+
  'B08303_008E', // 30–34 min
  'B08303_009E', // 35–39 min
  'B08303_010E', // 40–44 min
  'B08303_011E', // 45–59 min
  'B08303_012E', // 60–89 min
  'B08303_013E', // 90+ min
].join(',')

// Age distribution — separate call (46 vars, too many to combine above)
const AGE_VARS = [
  // Male age groups
  'B01001_003E','B01001_004E','B01001_005E','B01001_006E',           // 0-17
  'B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E', // 18-34
  'B01001_013E','B01001_014E','B01001_015E','B01001_016E',           // 35-54
  'B01001_017E','B01001_018E','B01001_019E','B01001_020E','B01001_021E','B01001_022E', // 55-74
  'B01001_023E','B01001_024E','B01001_025E',                         // 75+
  // Female age groups
  'B01001_027E','B01001_028E','B01001_029E','B01001_030E',           // 0-17
  'B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E', // 18-34
  'B01001_037E','B01001_038E','B01001_039E','B01001_040E',           // 35-54
  'B01001_041E','B01001_042E','B01001_043E','B01001_044E','B01001_045E','B01001_046E', // 55-74
  'B01001_047E','B01001_048E','B01001_049E',                         // 75+
].join(',')

// Census missing-value codes are large negatives (-666666666, -888888888, etc.)
function i(v: string | undefined) { const n = parseInt(v ?? '0'); return (isNaN(n) || n < 0) ? 0 : n }
function f(v: string | undefined) { const n = parseFloat(v ?? '0'); return (isNaN(n) || n < 0) ? 0 : n }
function pct(n: number, total: number) {
  return total > 0 ? parseFloat((n / total * 100).toFixed(1)) : 0
}

export async function fetchZipData(zip: string) {
  const key = process.env.CENSUS_API_KEY
  const base = `${CENSUS_BASE}/2023/acs/acs5`
  const geo  = `for=zip%20code%20tabulation%20area:${zip}&key=${key}`

  const [res, res2020, resAge] = await Promise.all([
    fetch(`${base}?get=NAME,${VARS}&${geo}`),
    fetch(`${CENSUS_BASE}/2020/dec/dhc?get=P1_001N&${geo}`),
    fetch(`${base}?get=${AGE_VARS}&${geo}`),
  ])

  const data     = await res.json()
  // Some ZCTAs didn't exist in 2020 (new subdivisions) — 204 No Content, no body to parse
  let data2020: unknown = null
  try { if (res2020.status !== 204) data2020 = await res2020.json() } catch { /* no 2020 data */ }
  const dataAge  = await resAge.json()

  // YFI/WFI vars fetched separately — some ZIPs return empty/error for these tables
  let dataYfiWfi: unknown = null
  try {
    const resYfiWfi = await fetch(`${base}?get=${YFI_WFI_VARS}&${geo}`)
    if (resYfiWfi.ok) dataYfiWfi = await resYfiWfi.json()
  } catch { /* leave null for ZIPs without coverage */ }

  // Occupation vars fetched separately
  let dataOcc: unknown = null
  try {
    const resOcc = await fetch(`${base}?get=C24010_001E,C24010_003E,C24010_039E&${geo}`)
    if (resOcc.ok) dataOcc = await resOcc.json()
  } catch { /* leave null */ }

  if (!data || data.length < 2) throw new Error(`No Census data for ZIP ${zip}`)

  const [headers, values] = data
  const r: Record<string, string> = {}
  headers.forEach((h: string, idx: number) => { r[h] = values[idx] })

  // Age data
  const ar: Record<string, string> = {}
  if (dataAge?.length >= 2) {
    const [ah, av] = dataAge
    ah.forEach((h: string, idx: number) => { ar[h] = av[idx] })
  }

  // YFI/WFI input data
  const yr: Record<string, string> = {}
  if (Array.isArray(dataYfiWfi) && dataYfiWfi.length >= 2) {
    const [yh, yv] = dataYfiWfi as string[][]
    yh.forEach((h: string, idx: number) => { yr[h] = yv[idx] })
  }

  // Occupation data
  const or: Record<string, string> = {}
  if (Array.isArray(dataOcc) && dataOcc.length >= 2) {
    const [oh, ov] = dataOcc as string[][]
    oh.forEach((h: string, idx: number) => { or[h] = ov[idx] })
  }

  // Occupational mix — % in management/professional/science/arts
  const occTotal    = i(or['C24010_001E'])
  const occMaleMgmt = i(or['C24010_003E'])
  const occFemMgmt  = i(or['C24010_039E'])
  const occMgmtProfPct = occTotal > 0
    ? parseFloat(((occMaleMgmt + occFemMgmt) / occTotal * 100).toFixed(1))
    : null

  // Population + growth
  const population   = i(r['B01001_001E'])
  const population2020 = Array.isArray(data2020) && data2020.length >= 2 ? i((data2020 as string[][])[1][0]) : null
  const rawGrowth = population2020 && population2020 > 0
    ? parseFloat(((population - population2020) / population2020 * 100).toFixed(1))
    : null
  // Null out ZIPs with known ZCTA boundary changes — comparison is invalid (not a real decline)
  // Cap at ±9999.9 for tiny base populations
  const populationGrowth = (rawGrowth !== null && !BOUNDARY_CHANGED.has(zip))
    ? Math.max(-9999.9, Math.min(9999.9, rawGrowth))
    : null

  // Labor
  const laborForce = i(r['B23025_002E'])
  const unemployed = i(r['B23025_005E'])

  // Education
  const edTotal      = i(r['B15003_001E'])
  const hsD          = i(r['B15003_017E']) + i(r['B15003_018E'])
  const someCol      = i(r['B15003_019E']) + i(r['B15003_020E']) + i(r['B15003_021E'])
  const bachelorsPlus = i(r['B15003_022E']) + i(r['B15003_023E']) + i(r['B15003_024E']) + i(r['B15003_025E'])
  const noHS         = Math.max(0, edTotal - hsD - someCol - bachelorsPlus)

  // Race/ethnicity
  const raceTotal  = i(r['B03002_001E'])
  const white      = i(r['B03002_003E'])
  const black      = i(r['B03002_004E'])
  const asian      = i(r['B03002_006E'])
  const hispanic   = i(r['B03002_012E'])
  const raceOther  = Math.max(0, raceTotal - white - black - asian - hispanic)

  // Income brackets
  const incTotal = i(r['B19001_001E'])
  const incPct   = (...vars: string[]) =>
    pct(vars.reduce((s, v) => s + i(r[v]), 0), incTotal)

  // Households
  const totalHouseholds   = i(r['B11001_001E'])
  const hhWithChildren    = i(r['B11005_002E'])
  const marriedTotal      = i(r['B11001_003E'])
  const livingAlone       = i(r['B11001_008E'])
  const marriedWithKids   = i(r['B11003_003E'])
  const marriedNoKids     = Math.max(0, marriedTotal - marriedWithKids)
  const singleParent      = Math.max(0, hhWithChildren - marriedWithKids)
  const hhOtherType       = Math.max(0, totalHouseholds - marriedTotal - singleParent - livingAlone)

  // Age distribution
  const agePct = (...vars: string[]) =>
    pct(vars.reduce((s, v) => s + i(ar[v]), 0), population)

  // Fertility signal
  const fertWomen    = i(yr['B13016_001E'])
  const fertBirths   = i(yr['B13016_002E'])
  const fertilityRate = fertWomen > 0 ? parseFloat((fertBirths / fertWomen).toFixed(4)) : null

  // Dual-earner families
  const totalFamilies     = i(yr['B23007_001E'])
  const dualEarnerWithKid = i(yr['B23007_004E'])
  const dualEarnerNoKid   = i(yr['B23007_014E'])
  const dualEarnerPct = totalFamilies > 0
    ? parseFloat(((dualEarnerWithKid + dualEarnerNoKid) / totalFamilies * 100).toFixed(1))
    : null

  // Commute burden — % of workers with 30+ min commute
  const commuteTotal   = i(yr['B08303_001E'])
  const commute30plus  = i(yr['B08303_008E']) + i(yr['B08303_009E']) + i(yr['B08303_010E']) +
                         i(yr['B08303_011E']) + i(yr['B08303_012E']) + i(yr['B08303_013E'])
  const commute30PlusPct = commuteTotal > 0
    ? parseFloat((commute30plus / commuteTotal * 100).toFixed(1))
    : null

  // SES class
  const income      = i(r['B19013_001E'])
  const homeValue   = i(r['B25077_001E'])
  const bachelorsRate = pct(bachelorsPlus, edTotal)
  const sesScore    = Math.round(
    Math.min(100, (income / 200000) * 100)    * 0.5 +
    Math.min(100, bachelorsRate * 2)           * 0.3 +
    Math.min(100, (homeValue / 800000) * 100)  * 0.2
  )
  const sesLabel =
    sesScore >= 78 ? 'Upper' :
    sesScore >= 58 ? 'Upper Middle' :
    sesScore >= 40 ? 'Middle' :
    sesScore >= 25 ? 'Lower Middle' : 'Lower Income'

  return {
    zip,
    name: r['NAME'],
    population,
    population2020,
    populationGrowth,
    medianHouseholdIncome: income,
    medianHomeValue:       homeValue,
    totalHouseholds,
    avgHouseholdSize:      f(r['B25010_001E']),
    hhWithChildrenPct:     pct(hhWithChildren, totalHouseholds),
    unemploymentRate:      laborForce > 0 ? parseFloat(((unemployed / laborForce) * 100).toFixed(1)) : null,
    bachelorsRate:         edTotal > 0 ? parseFloat((bachelorsPlus / edTotal * 100).toFixed(1)) : null,
    sesLabel,
    sesScore,
    race: {
      white:    pct(white,    raceTotal),
      hispanic: pct(hispanic, raceTotal),
      black:    pct(black,    raceTotal),
      asian:    pct(asian,    raceTotal),
      other:    pct(raceOther, raceTotal),
    },
    education: {
      noHSDiploma:   pct(noHS,         edTotal),
      hsDiploma:     pct(hsD,          edTotal),
      someCollege:   pct(someCol,      edTotal),
      bachelorsPlus: pct(bachelorsPlus, edTotal),
    },
    ageDistribution: {
      age0_17:   agePct('B01001_003E','B01001_004E','B01001_005E','B01001_006E','B01001_027E','B01001_028E','B01001_029E','B01001_030E'),
      age18_34:  agePct('B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E','B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E'),
      age35_54:  agePct('B01001_013E','B01001_014E','B01001_015E','B01001_016E','B01001_037E','B01001_038E','B01001_039E','B01001_040E'),
      age55_74:  agePct('B01001_017E','B01001_018E','B01001_019E','B01001_020E','B01001_021E','B01001_022E','B01001_041E','B01001_042E','B01001_043E','B01001_044E','B01001_045E','B01001_046E'),
      age75plus: agePct('B01001_023E','B01001_024E','B01001_025E','B01001_047E','B01001_048E','B01001_049E'),
    },
    householdTypes: {
      marriedWithChildren: pct(marriedWithKids, totalHouseholds),
      marriedNoChildren:   pct(marriedNoKids,   totalHouseholds),
      singleParent:        pct(singleParent,    totalHouseholds),
      livingAlone:         pct(livingAlone,     totalHouseholds),
      other:               pct(hhOtherType,     totalHouseholds),
    },
    incomeBrackets: [
      { label: '<$25K',     pct: incPct('B19001_002E','B19001_003E','B19001_004E','B19001_005E') },
      { label: '$25-50K',   pct: incPct('B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E') },
      { label: '$50-75K',   pct: incPct('B19001_011E','B19001_012E') },
      { label: '$75-100K',  pct: incPct('B19001_013E') },
      { label: '$100-150K', pct: incPct('B19001_014E','B19001_015E') },
      { label: '$150K+',    pct: incPct('B19001_016E','B19001_017E') },
    ],
    fertilityRate,
    dualEarnerPct,
    commute30PlusPct,
    occMgmtProfPct,
  }
}

export async function fetchZipProxy(zip: string): Promise<{ proxyBorn: number; proxyLanguage: number }> {
  const key = process.env.CENSUS_API_KEY
  const base = `${CENSUS_BASE}/2023/acs/acs5`
  const geo  = `for=zip%20code%20tabulation%20area:${zip}&key=${key}`

  const [resBorn, resLang] = await Promise.all([
    fetch(`${base}?get=${PROXY_BORN_VARS.join(',')}&${geo}`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${base}?get=${PROXY_LANG_VARS.join(',')}&${geo}`).then(r => r.ok ? r.json() : null).catch(() => null),
  ])

  const born: Record<string, string> = {}
  if (Array.isArray(resBorn) && resBorn.length >= 2) {
    const [h, v] = resBorn as string[][]
    h.forEach((col, idx) => { born[col] = v[idx] })
  }

  const lang: Record<string, string> = {}
  if (Array.isArray(resLang) && resLang.length >= 2) {
    const [h, v] = resLang as string[][]
    h.forEach((col, idx) => { lang[col] = v[idx] })
  }

  const proxyBorn     = PROXY_BORN_VARS.reduce((sum, v) => sum + i(born[v]), 0)
  const proxyLanguage = PROXY_LANG_VARS.reduce((sum, v) => sum + i(lang[v]), 0)

  return { proxyBorn, proxyLanguage }
}
