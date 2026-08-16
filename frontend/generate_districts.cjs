const fs = require('fs');
const path = require('path');
const india = require('india-states-districts');

const dir = path.join(__dirname, 'src', 'data');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const states = india.getAllStates();
const data = {};

for (const state of states) {
  data[state] = india.getDistrictsByState(state);
}

fs.writeFileSync(path.join(dir, 'indianDistricts.json'), JSON.stringify(data, null, 2));
console.log('Districts JSON generated successfully at src/data/indianDistricts.json');
