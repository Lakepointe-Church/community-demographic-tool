import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS } from '@/lib/zips'
import { fetchZipData } from '@/lib/census'
import { fetchZipEmployers } from '@/lib/cbp'

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

async function fetchMetroStats() {
  const fredKey = process.env.FRED_API_KEY

  const [blsRes, fredPopRes, fredHousingRes] = await Promise.all([
    fetch(BLS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: [
          'LAUMT481910000000003', // DFW unemployment rate
          'LAUMT481910000000006', // DFW employed persons
          'LAUMT481910000000007', // DFW labor force
        ],
        startyear: '2023',
        endyear: '2025',
        registrationkey: process.env.BLS_API_KEY,
      }),
    }),
    fetch(`${FRED_BASE}?series_id=DFWPOP&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
    fetch(`${FRED_BASE}?series_id=DALPOP&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`),
  ])

  const blsData = await blsRes.json()
  const fredPop = await fredPopRes.json()
  const fredHousing = await fredHousingRes.json()

  const series: Record<string, { latest: string; period: string; year: string }> = {}
  if (blsData.status === 'REQUEST_SUCCEEDED') {
    for (const s of blsData.Results.series) {
      const latest = s.data[0]
      series[s.seriesID] = { latest: latest?.value, period: latest?.periodName, year: latest?.year }
    }
  }

  const pop = fredPop.observations?.[0]
  const housing = fredHousing.observations?.[0]

  return {
    blsUnemploymentRate: parseFloat(series['LAUMT481910000000003']?.latest) || null,
    blsEmployedPersons:  parseInt(series['LAUMT481910000000006']?.latest) || null,
    blsLaborForce:       parseInt(series['LAUMT481910000000007']?.latest) || null,
    blsPeriod:           series['LAUMT481910000000003']?.period ?? null,
    blsYear:             series['LAUMT481910000000003']?.year ?? null,
    fredPopulation:      pop?.value ? parseFloat(pop.value) : null,
    fredPopulationDate:  pop?.date ?? null,
    fredHousingPermits:  housing?.value ? parseInt(housing.value) : null,
    fredHousingPermitsDate: housing?.date ?? null,
  }
}

export async function POST() {
  const errors: string[] = []
  let zipsRefreshed = 0

  // Fetch ZIPs in batches of 5 to avoid Census rate limits
  const zips = [...DFW_ZIPS]
  for (let i = 0; i < zips.length; i += 5) {
    const batch = zips.slice(i, i + 5)
    const results = await Promise.allSettled(batch.map(({ zip }) => fetchZipData(zip)))

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'rejected') {
        errors.push(`ZIP ${batch[j].zip}: ${String(result.reason)}`)
        continue
      }

      const d = result.value
      await sql`
        INSERT INTO zip_demographics (
          zip, name, population, population_2020, population_growth,
          median_household_income, median_home_value, total_households,
          avg_household_size, hh_with_children_pct, unemployment_rate,
          bachelors_rate, ses_label, ses_score,
          race_white, race_hispanic, race_black, race_asian, race_other,
          edu_no_hs, edu_hs_diploma, edu_some_college, edu_bachelors_plus,
          income_lt25k, income_25_50k, income_50_75k, income_75_100k,
          income_100_150k, income_150k_plus,
          age_0_17, age_18_34, age_35_54, age_55_74, age_75_plus,
          hh_married_with_children, hh_married_no_children,
          hh_single_parent, hh_living_alone, hh_other_type,
          fertility_rate, dual_earner_pct, commute_30plus_pct, occ_mgmt_prof_pct,
          updated_at
        ) VALUES (
          ${d.zip}, ${d.name}, ${d.population}, ${d.population2020}, ${d.populationGrowth},
          ${d.medianHouseholdIncome}, ${d.medianHomeValue}, ${d.totalHouseholds},
          ${d.avgHouseholdSize}, ${d.hhWithChildrenPct}, ${d.unemploymentRate},
          ${d.bachelorsRate}, ${d.sesLabel}, ${d.sesScore},
          ${d.race.white}, ${d.race.hispanic}, ${d.race.black}, ${d.race.asian}, ${d.race.other},
          ${d.education.noHSDiploma}, ${d.education.hsDiploma}, ${d.education.someCollege}, ${d.education.bachelorsPlus},
          ${d.incomeBrackets[0].pct}, ${d.incomeBrackets[1].pct}, ${d.incomeBrackets[2].pct},
          ${d.incomeBrackets[3].pct}, ${d.incomeBrackets[4].pct}, ${d.incomeBrackets[5].pct},
          ${d.ageDistribution.age0_17}, ${d.ageDistribution.age18_34}, ${d.ageDistribution.age35_54},
          ${d.ageDistribution.age55_74}, ${d.ageDistribution.age75plus},
          ${d.householdTypes.marriedWithChildren}, ${d.householdTypes.marriedNoChildren},
          ${d.householdTypes.singleParent}, ${d.householdTypes.livingAlone}, ${d.householdTypes.other},
          ${d.fertilityRate}, ${d.dualEarnerPct}, ${d.commute30PlusPct}, ${d.occMgmtProfPct},
          NOW()
        )
        ON CONFLICT (zip) DO UPDATE SET
          name                       = EXCLUDED.name,
          population                 = EXCLUDED.population,
          population_2020            = EXCLUDED.population_2020,
          population_growth          = EXCLUDED.population_growth,
          median_household_income    = EXCLUDED.median_household_income,
          median_home_value          = EXCLUDED.median_home_value,
          total_households           = EXCLUDED.total_households,
          avg_household_size         = EXCLUDED.avg_household_size,
          hh_with_children_pct       = EXCLUDED.hh_with_children_pct,
          unemployment_rate          = EXCLUDED.unemployment_rate,
          bachelors_rate             = EXCLUDED.bachelors_rate,
          ses_label                  = EXCLUDED.ses_label,
          ses_score                  = EXCLUDED.ses_score,
          race_white                 = EXCLUDED.race_white,
          race_hispanic              = EXCLUDED.race_hispanic,
          race_black                 = EXCLUDED.race_black,
          race_asian                 = EXCLUDED.race_asian,
          race_other                 = EXCLUDED.race_other,
          edu_no_hs                  = EXCLUDED.edu_no_hs,
          edu_hs_diploma             = EXCLUDED.edu_hs_diploma,
          edu_some_college           = EXCLUDED.edu_some_college,
          edu_bachelors_plus         = EXCLUDED.edu_bachelors_plus,
          income_lt25k               = EXCLUDED.income_lt25k,
          income_25_50k              = EXCLUDED.income_25_50k,
          income_50_75k              = EXCLUDED.income_50_75k,
          income_75_100k             = EXCLUDED.income_75_100k,
          income_100_150k            = EXCLUDED.income_100_150k,
          income_150k_plus           = EXCLUDED.income_150k_plus,
          age_0_17                   = EXCLUDED.age_0_17,
          age_18_34                  = EXCLUDED.age_18_34,
          age_35_54                  = EXCLUDED.age_35_54,
          age_55_74                  = EXCLUDED.age_55_74,
          age_75_plus                = EXCLUDED.age_75_plus,
          hh_married_with_children   = EXCLUDED.hh_married_with_children,
          hh_married_no_children     = EXCLUDED.hh_married_no_children,
          hh_single_parent           = EXCLUDED.hh_single_parent,
          hh_living_alone            = EXCLUDED.hh_living_alone,
          hh_other_type              = EXCLUDED.hh_other_type,
          fertility_rate             = EXCLUDED.fertility_rate,
          dual_earner_pct            = EXCLUDED.dual_earner_pct,
          commute_30plus_pct         = EXCLUDED.commute_30plus_pct,
          occ_mgmt_prof_pct          = EXCLUDED.occ_mgmt_prof_pct,
          updated_at                 = NOW()
      `
      zipsRefreshed++
    }
  }

  // CBP employer data — separate pass, batches of 5
  const employerErrors: string[] = []
  let employersRefreshed = 0
  for (let i = 0; i < zips.length; i += 5) {
    const batch = zips.slice(i, i + 5)
    const results = await Promise.allSettled(batch.map(({ zip }) => fetchZipEmployers(zip)))
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === 'rejected' || result.value === null) {
        employerErrors.push(`ZIP ${batch[j].zip}: CBP no data`)
        continue
      }
      const e = result.value
      await sql`
        INSERT INTO zip_employers (zip, total_estab, total_emp, total_payroll, sectors, updated_at)
        VALUES (${e.zip}, ${e.totalEstab}, ${e.totalEmp}, ${e.totalPayroll}, ${JSON.stringify(e.sectors)}, NOW())
        ON CONFLICT (zip) DO UPDATE SET
          total_estab   = EXCLUDED.total_estab,
          total_emp     = EXCLUDED.total_emp,
          total_payroll = EXCLUDED.total_payroll,
          sectors       = EXCLUDED.sectors,
          updated_at    = NOW()
      `
      employersRefreshed++
    }
  }
  errors.push(...employerErrors)

  // Metro stats (BLS + FRED)
  try {
    const m = await fetchMetroStats()
    await sql`
      INSERT INTO metro_stats (
        id, bls_unemployment_rate, bls_employed_persons, bls_labor_force,
        bls_period, bls_year, fred_population, fred_population_date,
        fred_housing_permits, fred_housing_permits_date, updated_at
      ) VALUES (
        1, ${m.blsUnemploymentRate}, ${m.blsEmployedPersons}, ${m.blsLaborForce},
        ${m.blsPeriod}, ${m.blsYear}, ${m.fredPopulation}, ${m.fredPopulationDate},
        ${m.fredHousingPermits}, ${m.fredHousingPermitsDate}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        bls_unemployment_rate     = EXCLUDED.bls_unemployment_rate,
        bls_employed_persons      = EXCLUDED.bls_employed_persons,
        bls_labor_force           = EXCLUDED.bls_labor_force,
        bls_period                = EXCLUDED.bls_period,
        bls_year                  = EXCLUDED.bls_year,
        fred_population           = EXCLUDED.fred_population,
        fred_population_date      = EXCLUDED.fred_population_date,
        fred_housing_permits      = EXCLUDED.fred_housing_permits,
        fred_housing_permits_date = EXCLUDED.fred_housing_permits_date,
        updated_at                = NOW()
    `
  } catch (e) {
    errors.push(`Metro stats: ${String(e)}`)
  }

  return NextResponse.json({
    ok: errors.length === 0,
    zipsRefreshed,
    errors: errors.length > 0 ? errors : undefined,
    refreshedAt: new Date().toISOString(),
  })
}
