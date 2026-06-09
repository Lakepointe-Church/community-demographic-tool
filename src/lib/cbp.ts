const CBP_BASE = 'https://api.census.gov/data/2022/cbp'

// Sectors: each has a short label and one or more NAICS 2-digit prefix strings.
// Retail (44-45), Manufacturing (31-33), and Transportation (48-49) each span
// multiple 2-digit codes that CBP never emits as a single row — aggregate them.
const SECTORS: { label: string; prefixes: string[] }[] = [
  { label: 'Agriculture',          prefixes: ['11'] },
  { label: 'Mining & Energy',      prefixes: ['21'] },
  { label: 'Utilities',            prefixes: ['22'] },
  { label: 'Construction',         prefixes: ['23'] },
  { label: 'Manufacturing',        prefixes: ['31', '32', '33'] },
  { label: 'Wholesale Trade',      prefixes: ['42'] },
  { label: 'Retail Trade',         prefixes: ['44', '45'] },
  { label: 'Transportation',       prefixes: ['48', '49'] },
  { label: 'Information & Tech',   prefixes: ['51'] },
  { label: 'Finance & Insurance',  prefixes: ['52'] },
  { label: 'Real Estate',          prefixes: ['53'] },
  { label: 'Professional Svcs',    prefixes: ['54'] },
  { label: 'Management',           prefixes: ['55'] },
  { label: 'Admin & Support',      prefixes: ['56'] },
  { label: 'Education',            prefixes: ['61'] },
  { label: 'Healthcare',           prefixes: ['62'] },
  { label: 'Arts & Recreation',    prefixes: ['71'] },
  { label: 'Food & Hospitality',   prefixes: ['72'] },
  { label: 'Other Services',       prefixes: ['81'] },
  { label: 'Government',           prefixes: ['92'] },
]

export interface ZipEmployerData {
  zip: string
  totalEstab: number
  totalEmp: number
  totalPayroll: number
  sectors: { label: string; estab: number }[]
}

export async function fetchZipEmployers(zip: string): Promise<ZipEmployerData | null> {
  const key = process.env.CENSUS_API_KEY
  let res: Response
  try {
    res = await fetch(`${CBP_BASE}?get=NAICS2017,ESTAB,EMP,PAYANN&for=zipcode:${zip}&key=${key}`)
    if (!res.ok) return null
  } catch {
    return null
  }

  let rows: string[][]
  try {
    rows = await res.json()
  } catch {
    return null
  }
  if (!rows || rows.length < 2) return null

  const [hdr, ...data] = rows
  const naicsIdx   = hdr.indexOf('NAICS2017')
  const estabIdx   = hdr.indexOf('ESTAB')
  const empIdx     = hdr.indexOf('EMP')
  const payannIdx  = hdr.indexOf('PAYANN')

  const totalRow = data.find(r => r[naicsIdx] === '00')
  const totalEstab   = totalRow ? parseInt(totalRow[estabIdx] || '0') : 0
  const totalEmp     = totalRow ? parseInt(totalRow[empIdx]   || '0') : 0
  const totalPayroll = totalRow ? parseInt(totalRow[payannIdx] || '0') : 0

  const sectors = SECTORS.map(s => {
    const estab = data
      .filter(r => s.prefixes.some(p => r[naicsIdx].startsWith(p)))
      .reduce((sum, r) => sum + parseInt(r[estabIdx] || '0'), 0)
    return { label: s.label, estab }
  }).filter(s => s.estab > 0)
    .sort((a, b) => b.estab - a.estab)

  return { zip, totalEstab, totalEmp, totalPayroll, sectors }
}
