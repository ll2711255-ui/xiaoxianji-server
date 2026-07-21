const db = require('./src/config/db');
db.query("SELECT id, name, channel, mchid, serial_no, LENGTH(api_key) as apiKeyLen, LENGTH(cert_pem) as certLen, LENGTH(key_pem) as keyLen, app_id, enabled, is_default FROM payment_methods")
  .then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
