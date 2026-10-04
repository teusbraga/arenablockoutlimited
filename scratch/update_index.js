const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const searchStr = '<option value="./assets/maps/city.json" selected>Cidade Abandonada 1000x1000 (Torre Central &amp; Ruas)</option>';
const replaceStr = '<option value="./assets/maps/vice.json" selected>Vice City 2000x2000 (Afronta GTA 6)</option>\n          <option value="./assets/maps/city.json">Cidade Abandonada 1000x1000 (Torre Central &amp; Ruas)</option>';
html = html.replace(searchStr, replaceStr);
fs.writeFileSync('index.html', html);
console.log("Updated index.html");
