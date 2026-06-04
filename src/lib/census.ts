const CENSUS_BASE = 'https://api.census.gov/data'

const VARS = [
  // Core demographics
  'B01001_001E', // Total population
  'B19013_001E', // Median household income
  'B25077_001E', // Median home value
  'B11001_001E', // Total households
  'B23025_005E', // Unemployed
  'B23025_002E', // Labor force
  // Education (B15003)
  'B15003_001E', // Total 25+
  'B15003_017E', // HS diploma
  'B15003_018E', // GED
  'B15003_019E', // Some college <1yr
  'B15003_020E', // Some college 1+yr
  'B15003_021E', // Associate's
  'B15003_022E', // Bachelor's
  'B15003_023E', // Master's
  'B15003_024E', // Professional
  'B15003_025E', // Doctorate
  // Race/ethnicity (B03002 — Hispanic origin)
  'B03002_001E', // Total
  'B03002_003E', // Non-Hispanic White
  'B03002_004E', // Non-Hispanic Black
  'B03002_006E', // Non-Hispanic Asian
  'B03002_012E', // Hispanic or Latino
  // Household composition
  'B11005_002E', // HH with own children under 18
  'B25010_001E', // Average household size
  // Income brackets (B19001)
  'B19001_001E',
  'B19001_002E', 'B19001_003E', 'B19001_004E', 'B19001_005E',
  'B19001_006E', 'B19001_007E', 'B19001_008E', 'B19001_009E', 'B19001_010E',
  'B19001_011E', 'B19001_012E',
  'B19001_013E',
  'B19001_014E', 'B19001_015E',
  'B19001_016E', 'B19001_017E',
].join(',')

function i(v: string | undefined) { return parseInt(v ?? '0') || 0 }
function f(v: string | undefined) { return parseFloat(v ?? '0') || 0 }
function pct(n: number, total: number, decimals = 1) {
  return total > 0 ? parseFloat((n / total * 100).toFixed(decimals)) : 0
}

export async function fetchZipData(zip: string) {
  const key = process.env.CENSUS_API_KEY
  const [res2023, res2020] = await Promise.all([
    fetch(`${CENSUS_BASE}/2023/acs/acs5?get=NAME,${VARS}&for=zip%20code%20tabulation%20area:${zip}&key=${key}`),
    fetch(`${CENSUS_BASE}/2020/acs/acs5?get=B01001_001E&for=zip%20code%20tabulation%20area:${zip}&key=${key}`),
  ])

  const data2023 = await res2023.json()
  const data2020 = await res2020.json()

  if (!data2023 || data2023.length < 2) throw new Error(`No Census data for ZIP ${zip}`)

  const [headers, values] = data2023
  const r: Record<string, string> = {}
  headers.forEach((h: string, idx: number) => { r[h] = values[idx] })

  // Population + growth
  const population = i(r['B01001_001E'])
  const population2020 = data2020?.length >= 2 ? i(data2020[1][0]) : null
  const populationGrowth = population2020 && population2020 > 0
    ? parseFloat(((population - population2020) / population2020 * 100).toFixed(1))
    : null

  // Labor
  const laborForce = i(r['B23025_002E'])
  const unemployed = i(r['B23025_005E'])

  // Education groupings
  const edTotal = i(r['B15003_001E'])
  const hsD = i(r['B15003_017E']) + i(r['B15003_018E'])
  const someCol = i(r['B15003_019E']) + i(r['B15003_020E']) + i(r['B15003_021E'])
  const bachelorsPlus = i(r['B15003_022E']) + i(r['B15003_023E']) + i(r['B15003_024E']) + i(r['B15003_025E'])
  const noHS = Math.max(0, edTotal - hsD - someCol - bachelorsPlus)

  // Race/ethnicity
  const raceTotal = i(r['B03002_001E'])
  const white = i(r['B03002_003E'])
  const black = i(r['B03002_004E'])
  const asian = i(r['B03002_006E'])
  const hispanic = i(r['B03002_012E'])
  const other = Math.max(0, raceTotal - white - black - asian - hispanic)

  // Income brackets
  const incTotal = i(r['B19001_001E'])
  const incPct = (...vars: string[]) =>
    pct(vars.reduce((s, v) => s + i(r[v]), 0), incTotal)

  // Household
  const totalHouseholds = i(r['B11001_001E'])
  const hhWithChildren = i(r['B11005_002E'])

  // SES class (composite score)
  const income = i(r['B19013_001E'])
  const homeValue = i(r['B25077_001E'])
  const bachelorsRate = pct(bachelorsPlus, edTotal)
  const sesScore = Math.round(
    Math.min(100, (income / 200000) * 100) * 0.5 +
    Math.min(100, bachelorsRate * 2) * 0.3 +
    Math.min(100, (homeValue / 800000) * 100) * 0.2
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
    medianHomeValue: homeValue,
    totalHouseholds,
    avgHouseholdSize: f(r['B25010_001E']),
    hhWithChildrenPct: pct(hhWithChildren, totalHouseholds),
    unemploymentRate: laborForce > 0 ? parseFloat(((unemployed / laborForce) * 100).toFixed(1)) : null,
    bachelorsRate: edTotal > 0 ? parseFloat((bachelorsPlus / edTotal * 100).toFixed(1)) : null,
    sesLabel,
    sesScore,
    race: {
      white: pct(white, raceTotal),
      hispanic: pct(hispanic, raceTotal),
      black: pct(black, raceTotal),
      asian: pct(asian, raceTotal),
      other: pct(other, raceTotal),
    },
    education: {
      noHSDiploma: pct(noHS, edTotal),
      hsDiploma: pct(hsD, edTotal),
      someCollege: pct(someCol, edTotal),
      bachelorsPlus: pct(bachelorsPlus, edTotal),
    },
    incomeBrackets: [
      { label: '<$25K',    pct: incPct('B19001_002E','B19001_003E','B19001_004E','B19001_005E') },
      { label: '$25-50K',  pct: incPct('B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E') },
      { label: '$50-75K',  pct: incPct('B19001_011E','B19001_012E') },
      { label: '$75-100K', pct: incPct('B19001_013E') },
      { label: '$100-150K',pct: incPct('B19001_014E','B19001_015E') },
      { label: '$150K+',   pct: incPct('B19001_016E','B19001_017E') },
    ],
  }
}
