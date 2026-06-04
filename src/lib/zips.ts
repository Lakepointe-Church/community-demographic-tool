export const DFW_ZIPS = [
  { zip: '75087', label: 'Rockwall' },
  { zip: '75032', label: 'Rockwall (Heath)' },
  { zip: '75098', label: 'Wylie' },
  { zip: '75189', label: 'Royse City' },
  { zip: '75126', label: 'Forney' },
  { zip: '75088', label: 'Rowlett' },
  { zip: '75150', label: 'Mesquite' },
  { zip: '75149', label: 'Mesquite South' },
  { zip: '75043', label: 'Garland East' },
  { zip: '75048', label: 'Sachse' },
  { zip: '75074', label: 'Plano East' },
  { zip: '75002', label: 'Allen' },
  { zip: '75013', label: 'Allen South' },
  { zip: '75070', label: 'McKinney West' },
  { zip: '75071', label: 'McKinney East' },
  { zip: '75040', label: 'Garland West' },
  { zip: '75160', label: 'Terrell' },
  { zip: '75114', label: 'Crandall' },
  { zip: '75181', label: 'Mesquite East' },
  { zip: '75135', label: 'Caddo Mills' },
] as const

export type ZipEntry = typeof DFW_ZIPS[number]
