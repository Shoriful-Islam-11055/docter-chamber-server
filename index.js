const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ftixa.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});



//verification jwt token
function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: 'unAuthorized access'});
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    
    if(err){
      return res.status(403).send({message: 'Forbidden access'});
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("doctor_chamber")
      .collection("docter_services");

    const bookingsCollection = client
      .db("doctor_chamber")
      .collection("booking");

    const usersCollection = client
      .db("doctor_chamber")
      .collection("users");

    const doctorCollection = client
      .db("doctor_chamber")
      .collection("doctors");


     /****************verify jwtAdmin *********************/

      const verifyAdmin = async(req, res, next) =>{
        // const email = req.params.email;
        const requester = req.decoded.email;
        const requesterAccount = await usersCollection.findOne({email: requester});
        if(requesterAccount.role ==='admin'){
          next();
        }
        else{
          res.status(403).send({message: 'Forbidden access'});
        }
      }


      //Create API for all data get
      app.get('/services', async(req, res) =>{
          const query = {};
          const cursor = servicesCollection.find(query);
          const services = await cursor.toArray();
          res.send(services);
      });

      /*************************************
       * For find all dada without slots from database
       *************************************/
       app.get('/specialty', async(req, res) =>{
        const query = {};
        const specialty = await servicesCollection.find(query).project({name :1}).toArray();
        res.send(specialty);
    });


       /*************************************
       * For find all user from database
       *************************************/
      app.get('/users', verifyJWT, async(req, res) =>{
        const users = await usersCollection.find().toArray();
        res.send(users);
      })

       /*************************************
       * For find all doctors from Added doctors
       *************************************/
      app.get('/doctor', verifyJWT,verifyAdmin, async(req, res) =>{
        const doctors = await doctorCollection.find().toArray();
        res.send(doctors);
      })


      /*************************************
       * get user from clint and send backend database
       *************************************/
       app.put('/user/:email', async(req, res) => {
        const email = req.params.email;
        const user = req.body;
        const filter = {email : email}
        const options = {upsert : true};
        const updateDoc = {
          $set : user,
        };
        const result = await usersCollection.updateOne(filter, updateDoc, options);
        const token = jwt.sign({email : email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '24h'})
        res.send({result, token});
      })

      /*************************************
       * If you admin then you so all items
       *************************************/
       app.get('/admin/:email',  async(req, res) =>{
        const email = req.params.email;
        const user = await usersCollection.findOne({email : email})
        const isAdmin = user.role === 'admin';
        res.send({admin : isAdmin});
      })


       /*************************************
       * Make Admin between users
       *************************************/
        app.put('/user/admin/:email',verifyJWT,verifyAdmin, async(req, res) => {
          const email = req.params.email;
          // const requester = req.decoded.email;
          // const requesterAccount = await usersCollection.findOne({email: requester});
          const filter = {email : email}
          const updateDoc = {
            $set : {role : 'admin'},
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
          
        })

      /**
       * API Naming convention
       * app.get('/booking') //get all bookings in this collection. or more than one or by filter
       * app.get("/booking/:id") // get specific booking
       * app.post("/booking") // add a new booking
       * app.patch("/booking/:id") // update one
       * app.delete("/booking?:id") // delete a booking
       */

      /*********************************
       * For adding data in database
       *********************************/
      app.post('/booking', async(req, res) => {
        //read data from clint side
        const booking = req.body;
        //For control duplicate booking in same day
        const query = {treatment: booking.treatment, date: booking.date, patient: booking.patient}
        const exists = await bookingsCollection.findOne(query);
        if(exists){
          return res.send({success : false, booking : exists})
        }
        //insert data in booking collection
        const result = await bookingsCollection.insertOne(booking);
        //send data in database
       return res.send({success : true, result});
      });

      /*************************************
       * Find available time slots for a day
       *************************************/
      app.get('/available', async(req, res) =>{
        const date = req.query.date;

        //step-1: get all services. output: [{}, {}, {}, {}..... ALL] 
        const services = await servicesCollection.find().toArray();
        
        //step-2: get the booking of that day. output: [{}, {}, {}, {}.....]
        const query = {date : date};
        const bookings = await bookingsCollection.find(query).toArray();
        

        //step-3: For each service, find booking for that day. output: [{}, {}, {}]
        services.forEach(service =>{
          //step-4: find booking for that service
          const serviceBooking = bookings.filter(b => b.treatment === service.name);
           //step-5: select slots for that service booking ["", "", ""...]
          const booked = serviceBooking.map(s=>s.slot);
          //step-6: select those slots that are not in booked ;  
          const available = service.slots.filter(s => !booked.includes(s));
          service.slots = available;
        })
        res.send(services)

      })

      /*************************************
       * get appoint data thats people appoints
       *************************************/
      app.get('/booking',verifyJWT, async(req, res) => {
        const patient = req.query.patient;
        // const authorization = req.headers.authorization;
        const decodedEmail = req.decoded.email;
        if(patient === decodedEmail){
          const query = {patient : patient}
        const bookings = await bookingsCollection.find(query).toArray();
        return res.send(bookings);
        }
        else{
          return res.status(403).send({message: 'forbidden access'});
        }  
      })   

     
       /*************************************
       * doctor add with image
       *************************************/
      app.post('/doctor', verifyJWT, verifyAdmin, async(req, res) =>{
          const doctor = req.body;
          const result = await doctorCollection.insertOne(doctor);
          res.send(result);
      });
      
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello, I am Okay");
});

app.listen(port, () => {
  console.log("server running");
});
