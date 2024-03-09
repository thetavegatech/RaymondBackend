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




// Start the Express server
app.listen(port, (err) => {
  if (err) {
    console.error('Error starting the server:', err);
  } else {
    console.log("Server is running on port 5002");
  }
});
