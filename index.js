const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
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

async function run() {
  try {
    await client.connect();
    const servicesCollection = client
      .db("doctor_chamber")
      .collection("docter_services");

    const bookingsCollection = client
      .db("doctor_chamber")
      .collection("booking");


      //Create API for all data get
      app.get('/services', async(req, res) =>{
          const query = {};
          const cursor = servicesCollection.find(query);
          const services = await cursor.toArray();
          res.send(services);
      });

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
        //insert data in booking collection
        const result = await bookingsCollection.insertOne(booking);
        //send data in database
        res.send(result);
      })

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
