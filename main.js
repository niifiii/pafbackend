require('dotenv').config()
const AWS = require('aws-sdk');
const multer = require('multer');
const morgan = require('morgan');
const express = require('express')
const mysql = require('mysql2/promise');
const cors =  require('cors');
const mongo = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const fs = require('fs');

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const app = express()

app.use(morgan('combined'))
app.use(cors())

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
		   console.log(results.length > 0 && payload['password'] === results[0].password);
		   
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
//////////////////////////////////////////////////////////////////////////////////////////////////////
//configure the databases
////MongoDB
//MongoDb Database Settings
const MONGO_DATABASE = 'articlesdb';
const MONGO_COLLECTION = 'articles';
const MONGO_URL = 'mongodb://localhost:27017' //Set MongoDb URL
//Get an instance of MongoClient
const mongoClient = new MongoClient(MONGO_URL, //Pass in the MONGO_URL here
	{ useNewUrlParser: true, useUnifiedTopology: true });



/////////////////////////

//Get instance of AWS-S3 connection
const s3 = new AWS.S3({
	endpoint: new AWS.Endpoint(process.env.AWS_S3_HOSTNAME), //digitalocean is aws compatible s3 store:AWS_S3_HOSTNAME
	accessKeyId: process.env.AWS_S3_ACCESSKEY_ID,
	secretAccessKey: process.env.AWS_S3_SECRET_ACCESSKEY
})

///////////////////////

//Set destination directory for multer (multiple part file) upload
const upload = multer({
	dest: process.env.TMP_DIR || '/opt/tmp/uploads'
})

////////////////////

//Create functions that create document i.e. row/object
const mkArticle = (params, image) => { //later pass in req.file.filename: this is a random auto-generated string

	/*
		formData.append('title', title); body
		formData.append('comments', comments); body
		formData.append('userName', userName); body
		formData.append('password', password); body
		formData.append('img', img.imageData, img.imageAsDataUrl); file

*/

	return {
		ts: new Date().getTime(), //Timestamp.fromNumber((new Date()).getTime()),
		title: params.title,
		comments: params.comments,
		image
	}
};

const readFile = (path) => new Promise(
	(resolve, reject) => {
		console.log('readFile()')
		fs.readFile(path, (err, buff) => { //req.file.path is passed in here, it is where the file was uploaded on the local disk: here is C:\opt\temp\uploads
			console.log('in readFile');
				if (null != err) { //buff is the file buffer: where file is read into
					console.log('have error')
					reject(err);
				} else {
					console.log('no error, fine') 
					resolve(buff);
				}
		})
	}
);

const putObject = (file, buff, s3) => new Promise( //buff is what is read into
	(resolve, reject) => {
		const params = {
			Bucket: process.env.AWS_S3_BUCKET_NAME, //AWS_S3_BUCKET_NAME
			Key: file.filename, //ok! this is the randomly generated long string by multer upload
			Body: buff, //to upload this buffer
			ACL: 'public-read', //For display via url
			ContentType: file.mimetype,
			ContentLength: file.size
		}
		s3.putObject(params, (err, result) => { //upload start
			if (null != err)
				reject(err)
			else
				resolve(result)
		})
	}
)

// POST /api/upload
//app.post('/api/upload', express.json(), (req, res) => { //this is a post, what do i need? i need a body parser, note that it now comes with express instance
app.post('/api/upload', 
	upload.single('img'), 
	async (req, res) => { //we need to specify what we want to upload, single or multiple, what is the key (body of req)
	//upload.single('img'), img is the req body key name
    //post headers + body is a json, NOT req.params.
    //temp-img: file fields -> req.file
    //string fields -> req.body
	//upload.single('img') is made form multer set dest
	
	
////function for insert to backend MongoDb 
/*
		formData.append('title', title); body
		formData.append('comments', comments); body
		formData.append('userName', userName); body
		formData.append('password', password); body
		formData.append('img', img.imageData, img.imageAsDataUrl); file

*/

	console.info('>>> req.body: ', req.body)
	console.info('>>> req.file: ', req.file)

	//res.on('finish', () => {
	//	// delete the temp file
	//	fs.unlink(req.file.path, () => { })
	//}) //this is an event handler, so can place on top of the res 

	//Check Authtentication
	const queryUsernamePassword = "SELECT * FROM user WHERE user_id=?;"; //works
	const findUsernamePassword = makeQuery(queryUsernamePassword, pool);
/*	
	await findUsernamePassword([req.body["userName"]])
        .then((results)=> {
            if (req.body['password'] !== results[0].password){
				res.status(401).json({error: "Not authenticated"})
            }
        }).catch((err) => {
            res.status(401).json({err: err.message}); //ret: {"err": "No record!"}
        });
*/
	const doc = mkArticle(req.body, req.file.filename)
	console.log('in here 1');

	readFile(req.file.path) //req.file.path is where the file was uploaded on the local disk: here is C:\opt\temp\uploads
		.then(buff => {//buff is the file buffer, what is read into
			//inser into S3
			console.log('in here 2')
			return putObject(req.file, buff, s3) //returns
		})
		.then(result => {
			console.log('>>>>>in here');
			return mongoClient.db(MONGO_DATABASE).collection(MONGO_COLLECTION) //insert and returns
				.insertOne(doc);
			
		})
		.then(results => {
			console.info('insert results: ', results) 
			fs.unlink(req.file.path, () => { })
			res.status(200)
			res.json({ id: results.ops[0]._id })
		})
		.catch(error => {
			console.error('insert error: ', error)
			res.status(500)
			res.json({ error })
		})
})


/*
app.listen(PORT, () => {
	console.info(`Application started on port ${PORT} at ${new Date()}`)
})*/


const p0 = new Promise(
	(resolve, reject) => {
		if ((!!process.env.AWS_S3_ACCESSKEY_ID) && (!!process.env.AWS_S3_SECRET_ACCESSKEY))
			resolve()
		else
			reject('S3 keys not found')
	}
)
const p1 = mongoClient.connect()

//start the server
const p2 = (async () => {
	const conn = await pool.getConnection()
	try {
		console.info('Pinging database...')
        await conn.ping()
        await console.log('Ping ok')
	} catch(e) {
        console.error('Cannot ping database', e);
    } finally {
		conn.release()
	}
})();

Promise.all([p0, p1, p2]) //dun use [[]]
	.then(() => {
		app.listen(PORT, () => {
			console.info(`Application started on port ${PORT} at ${new Date()}`)
		})
	})
	.catch(err => { console.error('Cannot connect: ', err) })
