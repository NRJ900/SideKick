const fs = require('fs');
const pngToIco = require('png-to-ico');

const input = 'src-tauri/icons/icon.png';
const output = 'src-tauri/icons/icon.ico';

console.log(`Converting ${input} to ${output}...`);

pngToIco([input])
    .then(buf => {
        fs.writeFileSync(output, buf);
        console.log('Successfully created icon.ico');
    })
    .catch(err => {
        console.error('Error converting icon:', err);
        process.exit(1);
    });
