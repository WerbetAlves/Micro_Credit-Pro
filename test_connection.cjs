const https = require('https');

const url = 'mwbqjvmmgnopgpgplgzi.supabase.co';
const path = '/rest/v1/';
const apikey = 'sb_publishable_DmSGbHAWLDQeUjvmVodluw_9ClLqdfz';

const options = {
  hostname: url,
  port: 443,
  path: path,
  method: 'GET',
  headers: {
    'apikey': apikey
  }
};

console.log(`Connecting to ${url}...`);

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

req.end();
