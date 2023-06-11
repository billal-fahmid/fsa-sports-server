const express = require('express')
const app = express()
const cors = require('cors')
const jwt =require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())



const verifyJWT=(req, res, next) =>{
  const authorization=req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error:true , message:'Unauthorized Access'})
  }

  const token= authorization.split(' ')[1]

  jwt.verify(token , process.env.ACCESS_TOKEN_SECRET , (err, decoded) =>{
    if(err){
      return res.status(401).send({error:true , message:'Unauthorized Access'})
    }
    req.decoded = decoded;
    next();
  })

}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vxlatcb.mongodb.net/?retryWrites=true&w=majority`;





const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const usersCollection = client.db('fsaDb').collection('users');
    const classesCollection = client.db('fsaDb').collection('classes');
    const selectClassCollection = client.db('fsaDb').collection('selectClass');

   
    app.post('/jwt' , (req,res )=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn:'7d'})
      res.send({token})
    })


    // save user info in db

    app.put('/users/:email' ,async (req, res) =>{
        const email = req.params.email;
        const user = req.body;
        const query = {email: email}
        const options = {
            upsert:true
        }
        const updatedDoc={
            $set:user
        }
        const result =await usersCollection.updateOne(query,updatedDoc,options)
        console.log(result);
        res.send(result)
    })

    app.get('/users' , async(req ,res) =>{
      const result = await usersCollection.find().toArray()
      res.send(result)
    })


    // classes api
    app.get('/classes' , async (req,res) =>{
        const result = await classesCollection.find().toArray()
        res.send(result)
    })

   app.post('/selectedclasses' , async (req, res) =>{
      const cla =req.body
      
      const result = await selectClassCollection.insertOne(cla)
      res.send(result)
   })    




    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('FSA Server is running..')
})

app.listen(port, () => {
  console.log(`FSA is running on port ${port}`)
})