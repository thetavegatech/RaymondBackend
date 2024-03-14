// const express = require("express");
// const mqtt = require("mqtt");
// const cors = require("cors");

// const app = express();
// const port = 5002;
// app.use(cors());


// let mqttData = {}

// // Connect to MQTT broker
// const mqttClient = mqtt.connect("mqtt://91.121.93.94:1883");

// // Handle MQTT connection event
// mqttClient.on("connect", () => {
//   console.log("Connected to MQTT broker");
//   mqttClient.subscribe("RaymondAirComp1", (err) => {
//     if (err) {
//       console.error('Error subscribing to MQTT topic:', err);
//     } else {
//       console.log('Subscribed to MQTT topic: RaymondAirComp1');
//     }
//   });
// });

// // Handle MQTT message event
// mqttClient.on("message", (topic, message) => {
//   try {
//     // Handle incoming MQTT messages here
//      mqttData = JSON.parse(message.toString());
//     // console.log(mqttData);
//   } catch (error) {
//     console.error('Error parsing MQTT data:', error);
//   }
// });


// app.get("/api/mqttdata" , async (req , res) => {
//   try{
//     res.send(mqttData)

//   }catch(err){
//     console.log(err)
//   }
// })



// // Start the Express server
// app.listen(port, (err) => {
//   if (err) {
//     console.error('Error starting the server:', err);
//   } else {
//     console.log("Server is running on port 5002");
//   }
// });



const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const mongoose = require("mongoose");
const MqttDataModel = require("./models/MqttData");

const app = express();
const port = 5002;

// Connect to MongoDB

const url ="mongodb+srv://thetavegaacc:Thetavegatech@cluster0.1p9ushl.mongodb.net/?retryWrites=true&w=majority"
mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

app.use(cors());

let mqttData = {};

// Connect to MQTT broker
const mqttClient = mqtt.connect("mqtt://91.121.93.94:1883");

// Handle MQTT connection event
mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe("RaymondAirComp1", (err) => {
    if (err) {
      console.error('Error subscribing to MQTT topic:', err);
    } else {
      console.log('Subscribed to MQTT topic: RaymondAirComp1');
    }
  });
});

// Handle MQTT message event
mqttClient.on("message", async (topic, message) => {
  try {
    // Handle incoming MQTT messages here
    mqttData = JSON.parse(message.toString());

    // Save the MQTT data to MongoDB
    const newMqttData = new MqttDataModel(mqttData);
    await newMqttData.save();

    // Update the in-memory data (if needed)
    // mqttData = JSON.parse(message.toString());
  } catch (error) {
    console.error('Error parsing MQTT data or saving to MongoDB:', error);
  }
});


app.get("/api/mqttdata", async (req, res) => {
  try {
    // console.log('Received request for /api/mqttdata');
    res.send(mqttData);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/api/hostaphcur", async (req, res) => {
  try {
    const allHostAPhCur = await MqttDataModel.find({}, { HostAPhCur: 1, _id: 0 }).sort({_id : -1}).limit(500);

    if (allHostAPhCur.length === 0) {
      return res.status(404).json({ error: "No MQTT data found" });
    }

    // Extract only the values from the array of objects
    const values = allHostAPhCur.map(item => item.HostAPhCur);

    // Remove falsy values (null, undefined, false, 0, "", NaN)
    const filteredValues = values.filter(value => value !== null && value !== undefined && value !== false && value !== 0 && value !== "" && !isNaN(value));

    res.status(200).json(filteredValues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/mqttpressure", async (req, res) => {
  try {
    const allAirFeedPressureData = await MqttDataModel.find({}, { AirFeedPre: 1, _id: 0 }).sort({ _id: -1 }).limit(500);

    if (allAirFeedPressureData.length === 0) {
      return res.status(404).json({ error: "No MQTT data found" });
    }

    // Extracting only the values and removing null values
    const airFeedPressureValues = allAirFeedPressureData
      .map(data => data.AirFeedPre)
      .filter(value => value !== null && value !== undefined);

    res.status(200).json(airFeedPressureValues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get('/api/getdataall', async (req, res) => {
  try {
    let query = {};

    // Check if startDate and endDate query parameters are provided
    if (req.query.startDate && req.query.endDate) {
      // Convert startDate and endDate strings to Date objects
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);

      // Add DateTime filter to the query
      query = {
        DateTime: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }

    // Fetch data based on the query and sort by DateTime in descending order
    const data = await MqttDataModel.find(query).sort({ DateTime: -1 }).limit(2000);

    res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ err: 'Internal Server Error' });
  }
});



// Start the Express server
app.listen(port, (err) => {
  if (err) {
    console.error('Error starting the server:', err);
  } else {
    console.log("Server is running on port 5002");
  }
});
