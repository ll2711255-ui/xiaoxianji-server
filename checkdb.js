const m = require('mongoose')
m.connect('mongodb://localhost:27017/xiaoxianji').then(async () => {
  const cols = await m.connection.db.listCollections().toArray()
  for (const c of cols) {
    const cnt = await m.connection.db.collection(c.name).countDocuments()
    console.log(c.name + ': ' + cnt)
  }
  process.exit(0)
}).catch(e => { console.error(e); process.exit(1) })
