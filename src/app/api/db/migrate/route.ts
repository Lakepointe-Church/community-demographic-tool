import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS zip_demographics (
        zip                   TEXT PRIMARY KEY,
        name                  TEXT,
        population            INTEGER,
        population_2020       INTEGER,
        population_growth     NUMERIC(5,1),
        median_household_income INTEGER,
        median_home_value     INTEGER,
        total_households      INTEGER,
        avg_household_size    NUMERIC(4,2),
        hh_with_children_pct  NUMERIC(5,1),
        unemployment_rate     NUMERIC(5,1),
        bachelors_rate        NUMERIC(5,1),
        ses_label             TEXT,
        ses_score             INTEGER,
        race_white            NUMERIC(5,1),
        race_hispanic         NUMERIC(5,1),
        race_black            NUMERIC(5,1),
        race_asian            NUMERIC(5,1),
        race_other            NUMERIC(5,1),
        edu_no_hs             NUMERIC(5,1),
        edu_hs_diploma        NUMERIC(5,1),
        edu_some_college      NUMERIC(5,1),
        edu_bachelors_plus    NUMERIC(5,1),
        income_lt25k          NUMERIC(5,1),
        income_25_50k         NUMERIC(5,1),
        income_50_75k         NUMERIC(5,1),
        income_75_100k        NUMERIC(5,1),
        income_100_150k       NUMERIC(5,1),
        income_150k_plus      NUMERIC(5,1),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS metro_stats (
        id                         INTEGER PRIMARY KEY DEFAULT 1,
        bls_unemployment_rate      NUMERIC(5,2),
        bls_employed_persons       BIGINT,
        bls_labor_force            BIGINT,
        bls_period                 TEXT,
        bls_year                   TEXT,
        fred_population            NUMERIC(10,1),
        fred_population_date       TEXT,
        fred_housing_permits       INTEGER,
        fred_housing_permits_date  TEXT,
        updated_at                 TIMESTAMPTZ DEFAULT NOW()
      )
    `

    return NextResponse.json({ ok: true, message: 'Tables created successfully' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
