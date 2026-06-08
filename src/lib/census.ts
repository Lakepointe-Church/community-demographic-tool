const CENSUS_BASE = 'https://api.census.gov/data'

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
    fetch(`${CENSUS_BASE}/2020/acs/acs5?get=B01001_001E&${geo}`),
    fetch(`${base}?get=${AGE_VARS}&${geo}`),
  ])

  const data    = await res.json()
  const data2020 = await res2020.json()
  const dataAge  = await resAge.json()

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

  // Population + growth
  const population   = i(r['B01001_001E'])
  const population2020 = data2020?.length >= 2 ? i(data2020[1][0]) : null
  const rawGrowth = population2020 && population2020 > 0
    ? parseFloat(((population - population2020) / population2020 * 100).toFixed(1))
    : null
  // Cap at ±9999.9 — tiny base populations produce meaningless extremes
  const populationGrowth = rawGrowth !== null ? Math.max(-9999.9, Math.min(9999.9, rawGrowth)) : null

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
  }
}
