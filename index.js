const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())



const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'Unauthorized Access' })
  }

  const token = authorization.split(' ')[1]

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'Unauthorized Access' })
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
    const paymentsCollection = client.db('fsaDb').collection('payments');
    const reviewsCollection = client.db('fsaDb').collection('reviews');


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query)
      if (user?.status !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next()
    }

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await usersCollection.findOne(query)
      if (user?.status !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' })
      }
      next()
    }

    //review api
    app.get('/reviews' , async (req,res) =>{
      const result = await reviewsCollection.find().toArray()
      res.send(result)
    })



    // save user info in db

    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email }
      const options = {
        upsert: true
      }
      const updatedDoc = {
        $set: user
      }
      const result = await usersCollection.updateOne(query, updatedDoc, options)
      console.log(result);
      res.send(result)
    })



    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query)
      // console.log(user)
      const result = user?.status
      // console.log({result})
      res.send(result)
    })

    app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id
      // console.log(id)
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/users/delete/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })



    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })




    // classes api
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find().toArray()
      res.send(result)
    })

    // approved Classes get
    app.get('/classes/approvedClasses', async (req, res) => {
      const query = { status: 'approved' }
      const result = await classesCollection.find(query).toArray()
      res.send(result)
    })



    app.post('/selectedclasses', async (req, res) => {
      const cla = req.body
      const result = await selectClassCollection.insertOne(cla)
      res.send(result)
    })

    app.get('/selectedclasses', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([])
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }

      const query = { email: email };
      const result = await selectClassCollection.find(query).toArray()
      res.send(result)
    })

    app.delete('/selectedclasses/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await selectClassCollection.deleteOne(query);
      res.send(result)
    })





    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(price, amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payments api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertedResult = await paymentsCollection.insertOne(payment);
      // const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      const queryUpdate = { _id: new ObjectId(payment.enrolledClassId) }
      const queryDelete = { _id: new ObjectId(payment.deletedId) }
      const deleteResult = await selectClassCollection.deleteOne(queryDelete)
      // console.log(payment , queryUpdate)
      const updateClasseSeatsEnrolled = {
        $set: {
          availableSeats: payment.availableSeats - 1,
          enrolled: payment.enrolled ? payment.enrolled++ : 1
        }
      }
      const updateClasseSeatsEnrolledFinal = await classesCollection.updateOne(queryUpdate, updateClasseSeatsEnrolled)

      res.send({ insertedResult, deleteResult ,updateClasseSeatsEnrolledFinal})
    })

  
    app.get('/enrolled/:email' , verifyJWT ,async(req ,res) =>{
      const email = req.params.email;
      const query = {email:email}
      const result = await paymentsCollection.find(query).sort({ date: -1 }).toArray()
      res.send(result)
    })



    // get instructor in users 
    app.get('/user/instructor' , async(req , res ) =>{
      const query = {status :'instructor'}
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })









    // add class for instructor
    app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
      const addClass = req.body;
      const result = await classesCollection.insertOne(addClass)
      res.send(result)
    })

    //  myclasses for instructor 

    app.get('/myclasses', verifyJWT, async (req, res) => {
      const email = req.query.email
      // console.log(email)
      if (!email) {
        return res.send([])
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }
      const query = { instructorEmail: email }
      const result = await classesCollection.find(query).toArray()
      res.send(result)

    })

    // update class for instructor

    app.patch('/classes/updateclass/:id', verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: data.name,
          price: data.price,
          availableSeats: data.availableSeats,

        }
      }
      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })





    // admin approved and pending and denied
    app.patch('/classes/approved/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'approved'
        }
      }
      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    app.patch('/classes/denied/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'denied'
        }
      }
      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    app.patch('/classes/feedback', async (req, res) => {
      const id = req.query.id;
      const feedback = req.query.feedback;
      // console.log(id, feedback)
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          feedback: feedback
        }
      }
      const result = await classesCollection.updateOne(filter, updatedDoc);
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