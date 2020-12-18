require('dotenv').config()
const morgan = require('morgan')
const express = require('express')
const mysql = require('mysql2/promise');

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const app = express()

app.use(morgan('combined'))

////MySqlServer Database Settings
const pool = mysql.createPool({
    host: process.env.MYSQL_SERVER,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: process.env.MYSQL_CONNECTION,
    //timezone: '+08:00'
});

////function for read from backend Mysqldb
const makeQuery = (sql, pool) =>  {
    console.log(sql);
    return (async (args) => {
        const conn = await pool.getConnection();
        try {
            let results = await conn.query(sql, args || []);
            console.log(results[0]);
            return results[0];
        }catch(err){
            console.log(err);
            return Promise.reject(err);
        } finally {
            conn.release();
        } 
    });
};

const queryUsernamePassword = "SELECT * FROM user WHERE user_id=?;"; //works
const findUsernamePassword = makeQuery(queryUsernamePassword, pool);

app.post('/api/authenticate', express.urlencoded({extended: true}), async (req, res) => {
	const payload = req.body;
	console.log(payload, payload['userName'],)
	await findUsernamePassword([payload["userName"]])
        .then((results)=> {
            //for (let r of results) {
            //    console.log('>>>r: ', r);
           // }

            if (results.length > 0 && payload['password'] === results[0].password){
				const isAuthenticated = 'Yes';
                res.format({ 
                    html: function () { 
                        console.log("html");
                        res.send(isAuthenticated); //was results
                    }, 
                    json: function () {
                        console.log("json");
                        res.status(200).json(isAuthenticated); // ret: [{"user_id":"barney","password":"1ee7760a3190c95641442f2be0ef7774e139fb1f"}]
                    } 								// was results
                }); 

            } else {
                throw new Error('Not authenticated'); //was No record!  
            }
        }).catch((err) => {
            res.status(401).json({err: err.message}); //ret: {"err": "No record!"}
        });
	//res.end();
})

app.listen(PORT, () => {
	console.info(`Application started on port ${PORT} at ${new Date()}`)
})
