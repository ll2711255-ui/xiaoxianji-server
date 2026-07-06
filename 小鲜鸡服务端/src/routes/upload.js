const router = require('express').Router()
const upload = require('../middleware/upload')
const { success, fail } = require('../utils/response')

// POST /upload/image
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json(fail('请选择文件'))
    const url = '/uploads/' + req.file.filename
    res.json(success({ url }))
  } catch (err) {
    res.status(500).json(fail('上传失败'))
  }
})

module.exports = router
