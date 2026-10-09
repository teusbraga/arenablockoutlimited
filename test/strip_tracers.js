import fs from 'fs';

const weaponsPath = './assets/weapons/weapons.json';
const data = JSON.parse(fs.readFileSync(weaponsPath, 'utf8'));

const ammoMap = {
  'ar15': '5.56_nato',
  'ak47': '7.62_soviet',
  'rifle_proto': 'energy_cell',
  'uzi': '9mm_para',
  'm249': '5.56_linked',
  'p9': '5.7_fn',
  'sw500': '500_magnum',
  'm12': '12_gauge',
  'vss': '9x39_sp5'
};

if (data.weapons) {
  for (const [wepId, ammoId] of Object.entries(ammoMap)) {
    if (data.weapons[wepId]) {
      data.weapons[wepId].ammo = ammoId;
      delete data.weapons[wepId].tracerColor;
      delete data.weapons[wepId].tracerProfile;
    }
  }
}

fs.writeFileSync(weaponsPath, JSON.stringify(data, null, 2));
console.log('Successfully stripped tracerProfiles and linked ammo.json');
