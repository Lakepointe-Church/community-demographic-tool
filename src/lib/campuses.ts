export interface CampusInfo {
  zip: string
  label: string
  lat: number
  lng: number
  status: 'existing' | 'soon'
}

// Approximate coordinates based on ZIP centroids.
// Replace with actual campus street addresses for more precise isochrones.
export const CAMPUSES: CampusInfo[] = [
  { zip: '75087', label: 'Rockwall',   lat: 32.9210, lng: -96.4597, status: 'existing' },
  { zip: '75150', label: 'Mesquite',   lat: 32.7745, lng: -96.6134, status: 'existing' },
  { zip: '75044', label: 'Firewheel',  lat: 32.9101, lng: -96.6605, status: 'existing' },
  { zip: '75126', label: 'Forney',     lat: 32.7484, lng: -96.4694, status: 'existing' },
  { zip: '75251', label: 'N. Dallas',  lat: 32.9115, lng: -96.8115, status: 'existing' },
  { zip: '75218', label: 'E. Dallas',  lat: 32.8329, lng: -96.7056, status: 'existing' },
  { zip: '75182', label: 'Sunnyvale',  lat: 32.7934, lng: -96.5445, status: 'existing' },
  { zip: '75189', label: 'Royse City', lat: 32.9748, lng: -96.3325, status: 'existing' },
  { zip: '75002', label: 'Lucas/Allen',lat: 33.1032, lng: -96.6716, status: 'soon'     },
  { zip: '75401', label: 'Greenville', lat: 33.1384, lng: -96.1108, status: 'soon'     },
]
