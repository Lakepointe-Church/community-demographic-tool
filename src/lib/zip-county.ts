// Static ZIP-to-county map for DFW metro ZIPs.
// Primary county assignment when a ZIP straddles a county line.
// Source: USPS geographic data + Census ZCTA reference.

export const ZIP_COUNTY: Record<string, string> = {
  // Collin County
  '75002': 'Collin', '75009': 'Collin', '75013': 'Collin',
  '75023': 'Collin', '75024': 'Collin', '75025': 'Collin',
  '75033': 'Collin', '75034': 'Collin', '75035': 'Collin',
  '75036': 'Collin', '75048': 'Collin', '75069': 'Collin',
  '75070': 'Collin', '75071': 'Collin', '75072': 'Collin',
  '75075': 'Collin', '75078': 'Collin', '75093': 'Collin',
  '75094': 'Collin', '75098': 'Collin', '75164': 'Collin',
  '75166': 'Collin', '75173': 'Collin', '75407': 'Collin',
  '75409': 'Collin', '75423': 'Collin', '75424': 'Collin',
  '75442': 'Collin', '75454': 'Collin',

  // Dallas County
  '75001': 'Dallas', '75006': 'Dallas', '75007': 'Dallas',
  '75010': 'Dallas', '75019': 'Dallas', '75038': 'Dallas',
  '75039': 'Dallas', '75040': 'Dallas', '75041': 'Dallas',
  '75042': 'Dallas', '75043': 'Dallas', '75044': 'Dallas',
  '75050': 'Dallas', '75051': 'Dallas', '75052': 'Dallas',
  '75054': 'Dallas', '75060': 'Dallas', '75061': 'Dallas',
  '75062': 'Dallas', '75063': 'Dallas', '75080': 'Dallas',
  '75081': 'Dallas', '75082': 'Dallas', '75088': 'Dallas',
  '75089': 'Dallas', '75104': 'Dallas', '75115': 'Dallas',
  '75116': 'Dallas', '75134': 'Dallas', '75137': 'Dallas',
  '75141': 'Dallas', '75146': 'Dallas', '75149': 'Dallas',
  '75150': 'Dallas', '75159': 'Dallas', '75172': 'Dallas',
  '75180': 'Dallas', '75181': 'Dallas', '75182': 'Dallas',
  '75201': 'Dallas', '75202': 'Dallas', '75203': 'Dallas',
  '75204': 'Dallas', '75205': 'Dallas', '75206': 'Dallas',
  '75207': 'Dallas', '75208': 'Dallas', '75209': 'Dallas',
  '75210': 'Dallas', '75211': 'Dallas', '75212': 'Dallas',
  '75214': 'Dallas', '75215': 'Dallas', '75216': 'Dallas',
  '75217': 'Dallas', '75218': 'Dallas', '75219': 'Dallas',
  '75220': 'Dallas', '75223': 'Dallas', '75224': 'Dallas',
  '75225': 'Dallas', '75226': 'Dallas', '75227': 'Dallas',
  '75228': 'Dallas', '75229': 'Dallas', '75230': 'Dallas',
  '75231': 'Dallas', '75232': 'Dallas', '75233': 'Dallas',
  '75234': 'Dallas', '75235': 'Dallas', '75236': 'Dallas',
  '75237': 'Dallas', '75238': 'Dallas', '75240': 'Dallas',
  '75241': 'Dallas', '75243': 'Dallas', '75244': 'Dallas',
  '75246': 'Dallas', '75247': 'Dallas', '75248': 'Dallas',
  '75249': 'Dallas', '75251': 'Dallas', '75252': 'Dallas',
  '75253': 'Dallas', '75254': 'Dallas', '75270': 'Dallas',
  '75287': 'Dallas',

  // Denton County
  '75022': 'Denton', '75028': 'Denton', '75056': 'Denton',
  '75057': 'Denton', '75065': 'Denton', '75067': 'Denton',
  '75068': 'Denton', '75077': 'Denton', '76201': 'Denton',
  '76203': 'Denton', '76205': 'Denton', '76207': 'Denton',
  '76208': 'Denton', '76209': 'Denton', '76210': 'Denton',
  '76226': 'Denton', '76227': 'Denton', '76247': 'Denton',
  '76249': 'Denton', '76258': 'Denton', '76259': 'Denton',
  '76262': 'Denton', '76266': 'Denton',

  // Ellis County
  '75101': 'Ellis', '75119': 'Ellis', '75125': 'Ellis',
  '75152': 'Ellis', '75154': 'Ellis', '75165': 'Ellis',
  '75167': 'Ellis', '76041': 'Ellis', '76064': 'Ellis',
  '76065': 'Ellis', '76084': 'Ellis', '76623': 'Ellis',
  '76651': 'Ellis', '76670': 'Ellis',

  // Hood County (extended)
  '76043': 'Hood', '76048': 'Hood', '76049': 'Hood',
  '76070': 'Hood', '76077': 'Hood', '76652': 'Hood',

  // Hunt County
  '75401': 'Hunt', '75402': 'Hunt', '75422': 'Hunt',
  '75428': 'Hunt', '75429': 'Hunt', '75433': 'Hunt',
  '75453': 'Hunt', '75474': 'Hunt', '75496': 'Hunt',

  // Johnson County
  '76009': 'Johnson', '76028': 'Johnson', '76031': 'Johnson',
  '76033': 'Johnson', '76044': 'Johnson', '76050': 'Johnson',
  '76058': 'Johnson', '76059': 'Johnson', '76061': 'Johnson',
  '76093': 'Johnson',

  // Kaufman County
  '75114': 'Kaufman', '75126': 'Kaufman', '75132': 'Kaufman',
  '75135': 'Kaufman', '75142': 'Kaufman', '75143': 'Kaufman',
  '75157': 'Kaufman', '75158': 'Kaufman', '75160': 'Kaufman',
  '75161': 'Kaufman', '75189': 'Kaufman',

  // Parker County
  '76008': 'Parker', '76020': 'Parker', '76023': 'Parker',
  '76035': 'Parker', '76066': 'Parker', '76073': 'Parker',
  '76078': 'Parker', '76082': 'Parker', '76085': 'Parker',
  '76086': 'Parker', '76087': 'Parker', '76088': 'Parker',
  '76462': 'Parker', '76476': 'Parker', '76486': 'Parker',
  '76487': 'Parker', '76490': 'Parker',

  // Rockwall County
  '75032': 'Rockwall', '75087': 'Rockwall',

  // Tarrant County
  '76001': 'Tarrant', '76002': 'Tarrant', '76005': 'Tarrant',
  '76006': 'Tarrant', '76010': 'Tarrant', '76011': 'Tarrant',
  '76012': 'Tarrant', '76013': 'Tarrant', '76014': 'Tarrant',
  '76015': 'Tarrant', '76016': 'Tarrant', '76017': 'Tarrant',
  '76018': 'Tarrant', '76021': 'Tarrant', '76022': 'Tarrant',
  '76034': 'Tarrant', '76036': 'Tarrant', '76039': 'Tarrant',
  '76040': 'Tarrant', '76051': 'Tarrant', '76052': 'Tarrant',
  '76053': 'Tarrant', '76054': 'Tarrant', '76060': 'Tarrant',
  '76063': 'Tarrant', '76092': 'Tarrant', '76102': 'Tarrant',
  '76103': 'Tarrant', '76104': 'Tarrant', '76105': 'Tarrant',
  '76106': 'Tarrant', '76107': 'Tarrant', '76108': 'Tarrant',
  '76109': 'Tarrant', '76110': 'Tarrant', '76111': 'Tarrant',
  '76112': 'Tarrant', '76114': 'Tarrant', '76115': 'Tarrant',
  '76116': 'Tarrant', '76117': 'Tarrant', '76118': 'Tarrant',
  '76119': 'Tarrant', '76120': 'Tarrant', '76123': 'Tarrant',
  '76126': 'Tarrant', '76129': 'Tarrant', '76131': 'Tarrant',
  '76132': 'Tarrant', '76133': 'Tarrant', '76134': 'Tarrant',
  '76135': 'Tarrant', '76137': 'Tarrant', '76140': 'Tarrant',
  '76148': 'Tarrant', '76155': 'Tarrant', '76164': 'Tarrant',
  '76177': 'Tarrant', '76179': 'Tarrant', '76180': 'Tarrant',
  '76182': 'Tarrant', '76244': 'Tarrant', '76248': 'Tarrant',

  // Wise County
  '76071': 'Wise', '76225': 'Wise', '76234': 'Wise',
  '76267': 'Wise', '76270': 'Wise', '76426': 'Wise',
  '76431': 'Wise',

  // Extended counties
  // Cooke County
  '76238': 'Cooke', '76240': 'Cooke', '76241': 'Cooke',
  '76250': 'Cooke', '76252': 'Cooke', '76253': 'Cooke',
  '76272': 'Cooke',

  // Fanin County
  '75418': 'Fanin', '75438': 'Fanin', '75448': 'Fanin',
  '75449': 'Fanin', '75452': 'Fanin', '75469': 'Fanin',
  '75490': 'Fanin',

  // Grayson County
  '75020': 'Grayson', '75021': 'Grayson', '75058': 'Grayson',
  '75076': 'Grayson', '75090': 'Grayson', '75092': 'Grayson',
  '75413': 'Grayson', '75414': 'Grayson', '75439': 'Grayson',
  '75459': 'Grayson', '75475': 'Grayson', '75476': 'Grayson',
  '75479': 'Grayson', '75489': 'Grayson', '75491': 'Grayson',
  '75492': 'Grayson', '75495': 'Grayson', '76233': 'Grayson',
  '76245': 'Grayson', '76264': 'Grayson', '76268': 'Grayson',
  '76271': 'Grayson', '76273': 'Grayson',

  // Henderson County
  '75148': 'Henderson', '75156': 'Henderson', '75163': 'Henderson',
  '75751': 'Henderson', '75752': 'Henderson',

  // Hill County
  '76055': 'Hill', '76621': 'Hill', '76622': 'Hill',
  '76627': 'Hill', '76645': 'Hill', '76648': 'Hill',
  '76654': 'Hill', '76660': 'Hill', '76666': 'Hill',
  '76671': 'Hill', '76673': 'Hill', '76686': 'Hill',
  '76691': 'Hill', '76692': 'Hill',

  // Hopkins County
  '75420': 'Hopkins', '75482': 'Hopkins',

  // Montague County
  '76239': 'Montague',

  // Navarro County
  '75102': 'Navarro', '75105': 'Navarro', '75109': 'Navarro',
  '75110': 'Navarro', '75153': 'Navarro', '75155': 'Navarro',
  '75848': 'Navarro', '75859': 'Navarro', '76626': 'Navarro',
  '76628': 'Navarro', '76631': 'Navarro', '76636': 'Navarro',
  '76639': 'Navarro', '76641': 'Navarro', '76650': 'Navarro',
  '76676': 'Navarro', '76679': 'Navarro', '76693': 'Navarro',

  // Rains County
  '75440': 'Rains', '75472': 'Rains', '75497': 'Rains',

  // Van Zandt County
  '75103': 'Van Zandt', '75117': 'Van Zandt', '75124': 'Van Zandt',
  '75127': 'Van Zandt', '75140': 'Van Zandt', '75147': 'Van Zandt',
  '75169': 'Van Zandt', '75754': 'Van Zandt', '75778': 'Van Zandt',
  '75790': 'Van Zandt',

  // Wood County
  '75410': 'Wood',
}

// Counties in the official 11-county DFW-Plano-Arlington MSA
export const CORE_MSA_COUNTIES = new Set([
  'Dallas', 'Tarrant', 'Collin', 'Denton',
  'Rockwall', 'Ellis', 'Johnson', 'Kaufman',
  'Parker', 'Wise', 'Hunt',
])
