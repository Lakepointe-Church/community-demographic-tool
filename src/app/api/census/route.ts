import { NextRequest, NextResponse } from 'next/server'

const CENSUS_API_BASE = 'https://api.census.gov/data'
const CENSUS_KEY = process.env.CENSUS_API_KEY
console.log('Census key loaded:', CENSUS_KEY ? `${CENSUS_KEY.substring(0, 6)}...` : 'MISSING')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const zip = searchParams.get('zip')

  if (!zip) {
    return NextResponse.json({ error: 'zip parameter is required' }, { status: 400 })
  }

  try {
    const variables = [
      'B01001_001E', // Total population
      'B19013_001E', // Median household income
      'B25077_001E', // Median home value
      'B15003_022E', // Bachelor's degree
      'B15003_001E', // Total education population
      'B11001_001E', // Total households
      'B23025_005E', // Unemployed
      'B23025_002E', // Labor force
    ].join(',')

    const url = `${CENSUS_API_BASE}/2023/acs/acs5?get=NAME,${variables}&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_KEY}`

    const response = await fetch(url)
    const data = await response.json()

    if (!data || data.length < 2) {
      return NextResponse.json({ error: 'No data found for this ZIP code' }, { status: 404 })
    }

    const [headers, values] = data
    const result: Record<string, string> = {}
    headers.forEach((header: string, i: number) => {
      result[header] = values[i]
    })

    const population = parseInt(result['B01001_001E'])
    const laborForce = parseInt(result['B23025_002E'])
    const unemployed = parseInt(result['B23025_005E'])
    const bachelors = parseInt(result['B15003_022E'])
    const totalEd = parseInt(result['B15003_001E'])

    return NextResponse.json({
      zip,
      name: result['NAME'],
      population,
      medianHouseholdIncome: parseInt(result['B19013_001E']),
      medianHomeValue: parseInt(result['B25077_001E']),
      unemploymentRate: laborForce > 0 ? ((unemployed / laborForce) * 100).toFixed(1) : null,
      bachelorsRate: totalEd > 0 ? ((bachelors / totalEd) * 100).toFixed(1) : null,
      totalHouseholds: parseInt(result['B11001_001E']),
    })
    } catch (error) {
    console.error('Census API error:', error)
    return NextResponse.json({ error: 'Failed to fetch Census data', details: String(error) }, { status: 500 })
  }
}