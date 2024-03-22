const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const mongoose = require("mongoose");
const MqttDataModel = require("./models/MqttData");
const moment = require("moment")

const app = express();
const port = 5002;

// Connect to MongoDB

  const url ="mongodb+srv://thetavegaacc:Thetavegatech@cluster0.1p9ushl.mongodb.net/?retryWrites=true&w=majority"
//  const url = "mongodb://localhost:27017/MqttdataRaymond"
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
    // Get the start and end of the current day
    const startOfDay = moment().startOf('day');
    const endOfDay = moment().endOf('day');

    // MongoDB aggregation pipeline to group data into 1-minute intervals
    const result = await MqttDataModel.aggregate([
      {
        $match: {
          DateTime: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() }
        }
      },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: "$DateTime" },
                { $mod: [{ $toLong: "$DateTime" }, 60000] } // Group by 1-minute intervals
              ]
            }
          },
          value: { $avg: "$HostAPhCur" } // Calculate average value within each interval
        }
      },
      {
        $sort: { _id: -1 } // Sort by timestamp
      }
    ]);

    // Extract values and dates from the aggregation result
    const values = result.map(item => item.value.toFixed(1));
    const dates = result.map(item => item._id);

    res.status(200).json({ values, dates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/mqttpressure", async (req, res) => {
  try {
    // Get the start and end of the current day
    const startOfDay = moment().startOf('day');
    const endOfDay = moment().endOf('day');

    // MongoDB aggregation pipeline to group data into 1-minute intervals
    const result = await MqttDataModel.aggregate([
      {
        $match: {
          DateTime: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() }
        }
      },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: "$DateTime" },
                { $mod: [{ $toLong: "$DateTime" }, 60000] } // Group by 1-minute intervals
              ]
            }
          },
          value: { $avg: "$AirFeedPre" } // Calculate average value within each interval
        }
      },
      {
        $sort: { _id: -1 } // Sort by timestamp
      }
    ]);

    // Extract values and dates from the aggregation result
    const values = result.map(item => item.value.toFixed(1));
    const dates = result.map(item => item._id);

    res.status(200).json({ values, dates });
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



app.get("/api/hostcurhighlow", async (req, res) => {
  try {
    // Get the current date
    const today = new Date();
    // Set the time to the beginning of the day (midnight)
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    // Set the time to the end of the day (just before midnight of the next day)
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0);

    const response = await MqttDataModel.aggregate([
      {
        $match: {
          DateTime: {
            $gte: startOfToday,
            $lt: endOfToday
          }
        }
      },
      {
        $group: {
          _id: null,
          minHostAPhCur: { $min: "$HostAPhCur" },
          maxHostAPhCur: { $max: "$HostAPhCur" },
          avgHostAPhCur: { $avg: "$HostAPhCur" },
          minAirFeedPre: { $min: "$AirFeedPre" },
          maxAirFeedPre: { $max: "$AirFeedPre" },
          avgAirFeedPre: { $avg: "$AirFeedPre" },
          minAirExstTemp: { $min: "$AirExstTemp" },
          maxAirExstTemp: { $max: "$AirExstTemp" },
          avgAirExstTemp: { $avg: "$AirExstTemp" },
          count: { $sum: 1 } // Counting the number of records
        }
      }
    ]);

    // Extract results from response
    const {
      minHostAPhCur,
      maxHostAPhCur,
      avgHostAPhCur,
      minAirFeedPre,
      maxAirFeedPre,
      avgAirFeedPre,
      minAirExstTemp,
      maxAirExstTemp,
      avgAirExstTemp,
      count
    } = response[0];

    res.status(200).json({ 
      curhostmin: minHostAPhCur, 
      curhostmax: maxHostAPhCur, 
      curhostavg: avgHostAPhCur.toFixed(1), 
      airmin: minAirFeedPre, 
      airmax: maxAirFeedPre,
      airavg: avgAirFeedPre.toFixed(1),
      airtmpmin: minAirExstTemp,
      airtmpmax: maxAirExstTemp,
      airtmpavg: avgAirExstTemp.toFixed(1),
      count: count // Total count of records
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
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
