const morgan = require('morgan')
const express = require('express')

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const app = express()

app.use(morgan('combined'))



app.listen(PORT, () => {
	console.info(`Application started on port ${PORT} at ${new Date()}`)
})
