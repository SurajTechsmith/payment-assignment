require('dotenv').config()
const express = require('express')
const app = express()

app.use(express.json())


app.use('/payments', require('./routes/payment'))


app.use((err, req, res, next) => {
  console.error(`[Error] ${err.message}`)
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error'
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

module.exports = app