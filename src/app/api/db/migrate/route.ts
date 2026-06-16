import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS zip_demographics (
        zip                   TEXT PRIMARY KEY,
        name                  TEXT,
        population            INTEGER,
        population_2020       INTEGER,
        population_growth     NUMERIC(8,1),
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
        hhi_moe               INTEGER,
        low_reliability       BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Add reliability columns to existing tables (idempotent)
    await sql`ALTER TABLE zip_demographics ADD COLUMN IF NOT EXISTS hhi_moe INTEGER`
    await sql`ALTER TABLE zip_demographics ADD COLUMN IF NOT EXISTS low_reliability BOOLEAN NOT NULL DEFAULT FALSE`

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
        sector_wages               JSONB,
        updated_at                 TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS religious_orgs (
        ein           TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        street        TEXT,
        city          TEXT,
        state         TEXT,
        zip           TEXT,
        ntee_cd       TEXT,
        ntee_category TEXT,
        ntee_label    TEXT,
        ruling_year   INTEGER,
        status        TEXT,
        subsection    TEXT,
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_religious_orgs_zip  ON religious_orgs(zip)`
    await sql`CREATE INDEX IF NOT EXISTS idx_religious_orgs_ntee ON religious_orgs(ntee_cd)`

    await sql`
      CREATE TABLE IF NOT EXISTS religious_adherence (
        fips                 TEXT PRIMARY KEY,
        county               TEXT NOT NULL,
        region               TEXT NOT NULL,
        population           INTEGER,
        total_adherents      INTEGER,
        unclaimed            INTEGER,
        evangelical          INTEGER,
        mainline_protestant  INTEGER,
        black_protestant     INTEGER,
        catholic             INTEGER,
        orthodox             INTEGER,
        jewish               INTEGER,
        buddhist             INTEGER,
        hindu                INTEGER,
        muslim               INTEGER,
        other_christian      INTEGER,
        other                INTEGER,
        congregations        INTEGER,
        source               TEXT DEFAULT '2020 U.S. Religion Census (ASARB)',
        updated_at           TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS attendee_density (
        zip                TEXT PRIMARY KEY,
        total_households   INT NOT NULL DEFAULT 0,
        campus_breakdown   JSONB,
        source_date        TEXT,
        updated_at         TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS county_permits (
        fips          TEXT NOT NULL,
        county        TEXT NOT NULL,
        year          INT  NOT NULL,
        sf_permits    INT  NOT NULL DEFAULT 0,
        mf_permits    INT  NOT NULL DEFAULT 0,
        total_permits INT  NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (fips, year)
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS isd_enrollment (
        district_id   TEXT NOT NULL,
        district_name TEXT NOT NULL,
        county        TEXT NOT NULL,
        year          INT  NOT NULL,
        enrollment    INT  NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (district_id, year)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_isd_enrollment_county ON isd_enrollment(county)`

    await sql`
      CREATE TABLE IF NOT EXISTS county_projections (
        fips       TEXT PRIMARY KEY,
        county     TEXT NOT NULL,
        base_2020  INT,
        proj_2025  INT,
        proj_2030  INT,
        proj_2035  INT,
        proj_2040  INT,
        proj_2050  INT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS place_permits (
        state_fips    TEXT NOT NULL,
        place_fips    TEXT NOT NULL,
        place_name    TEXT NOT NULL,
        county_fips   TEXT NOT NULL,
        county        TEXT NOT NULL,
        year          INT  NOT NULL,
        sf_permits    INT  NOT NULL DEFAULT 0,
        mf_permits    INT  NOT NULL DEFAULT 0,
        total_permits INT  NOT NULL DEFAULT 0,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (state_fips, place_fips, year)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_place_permits_county_year ON place_permits(county, year)`

    await sql`
      CREATE TABLE IF NOT EXISTS decision_log (
        id           SERIAL PRIMARY KEY,
        zip          TEXT NOT NULL,
        area         TEXT,
        fit_score    INTEGER,
        scenario_url TEXT,
        notes        TEXT,
        decided_by   TEXT,
        logged_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Commute corridors — LEHD LODES8 origin-destination, aggregated block→ZCTA
    await sql`
      CREATE TABLE IF NOT EXISTS commute_flows (
        home_zip          TEXT NOT NULL,
        work_zip          TEXT NOT NULL,
        jobs              INTEGER NOT NULL,
        high_earner_jobs  INTEGER NOT NULL DEFAULT 0,
        year              INTEGER NOT NULL,
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (home_zip, work_zip, year)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_commute_flows_home ON commute_flows(home_zip, year)`

    // Per-home-ZIP commute headline metrics (computed over the full OD set, not just stored top corridors)
    await sql`
      CREATE TABLE IF NOT EXISTS commute_summary (
        home_zip         TEXT NOT NULL,
        year             INTEGER NOT NULL,
        total_workers    INTEGER NOT NULL,
        work_in_zip      INTEGER NOT NULL,
        top_dest_zip     TEXT,
        net_bearing_deg  NUMERIC(5,1),
        direction_label  TEXT,
        concentration    NUMERIC(4,3),
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (home_zip, year)
      )
    `

    return NextResponse.json({ ok: true, message: 'Tables created successfully' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
