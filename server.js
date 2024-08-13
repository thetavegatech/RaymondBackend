const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const mongoose = require("mongoose");
const MqttDataModel = require("./models/MqttData");
const moment = require('moment-timezone');
const nodemailer = require("nodemailer")
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const cron = require("node-cron")

const app = express();
const port = 5002;

// Connect to MongoDB

    const url ="mongodb+srv://thetavegaacc:Thetavegatech@cluster0.1p9ushl.mongodb.net/?retryWrites=true&w=majority"
    // const url = "mongodb://localhost:27017/MqttdataRaymond"
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



// app.get("/api/getnewhostacur", async (req, res) => {
//   try {
//     // Get start and end dates from query parameters, default to current day if not provided
//     const startDate = req.query.startDate ? moment(req.query.startDate) : moment().startOf('day');
//     const endDate = req.query.endDate ? moment(req.query.endDate) : moment().endOf('day');
    
//     // Fetch data based on the provided date range
//     const getdata = await MqttDataModel.find({
//       DateTime: {
//         $gte: startDate.toDate(), // Greater than or equal to start date
//         $lte: endDate.toDate()    // Less than or equal to end date
//       }
//     }, {HostAPhCur : 1, DateTime : 1}).sort({_id : -1}).lean();
    
//     res.status(200).json(getdata);
//   } catch (error) {
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });



app.get("/api/getnewhostacur", async (req, res) => {
  try {
    // Get start and end dates from query parameters, default to current day if not provided
    const startDate = req.query.startDate ? moment(req.query.startDate) : moment().startOf('day');
    const endDate = req.query.endDate ? moment(req.query.endDate) : moment().endOf('day');

    // Fetch data based on the provided date range
    const getdata = await MqttDataModel.aggregate([
      {
        $match: {
          DateTime: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          }
        }
      },
      {
        $sort: { _id: -1 } // Sort by _id in descending order
      },
      {
        $group: {
          _id: null,
          data: { $push: { DateTime: "$DateTime", HostAPhCur: "$HostAPhCur" } }
        }
      },
      {
        $project: {
          _id: 0,
          paginatedData: {
            $map: {
              input: { $range: [0, { $size: "$data" }, 100] }, // Create array of indices with step 100
              as: "index",
              in: {
                Date: { $arrayElemAt: ["$data.DateTime", "$$index"] },
                HostAPhCur: {
                  $avg: {
                    $slice: ["$data.HostAPhCur", "$$index", 100] // Slice and calculate average
                  }
                }
              }
            }
          }
        }
      }
    ]);

    // Extract paginated data from aggregation result
    const paginatedData = getdata.length > 0 ? getdata[0].paginatedData : [];

    res.status(200).json(paginatedData);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});




// this is for send the mail on 6 pm 
// // dfhaoefd
const transporter = nodemailer.createTransport({
  secure: true,
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: "ttpldevelopers@gmail.com",
    pass: "ymzk oxjh mcxn khiu" // Replace with your actual app-specific password
  }
});

// Function to generate Excel file
async function generateExcelFile(data, binaryArray, binaryArray2) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    worksheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 30 },
      { header: 'Status', key: 'status', width: 20 }
    ];

    const filteredData = {
      AirFeedPressure: data.AirFeedPre / 10 + " Bar",
      AirExstTemperature: data.AirExstTemp - 50 + " °C",
      RunTimeHours: data.RunTime + " Hours",
      LoadTimeInHours: data.LoadTime + " Hours",
      HostAPhaseCurrent: data.HostAPhCur / 10 + " A",
      // Spare1: data.Spare1,
      // Spare2: data.Spare2,
      // RunState1: data.RunState1,
      // RunState2: data.RunState2,
      // ControlState: data.ControlState,
      OilFilterusedtime: data.OilfilterT + " Hours",
      OilSeparatorusedtime: data.OilSepTime + " Hours",
      AirFilterusedtime: data.AirFiltTIme + " Hours",
      LubeOilusedtime: data.LubeOilTime + " Hours",
      LubeGreaseusedtime: data.LubeGreaseT + " Hours",
      DateTime: data.DateTime
    };

    const statusArray = [
      { field: 'Load Status', status: binaryArray[0] === '1' ? 'Load' : 'Unload' },
      { field: 'Run Status', status: binaryArray[1] === '1' ? 'Run' : 'Stop' },
      { field: 'Air Exhaust Temperature', status: binaryArray[3] === '1' ? 'High' : 'OK' },
      { field: 'Phase Sequence', status: binaryArray[4] === '1' ? 'Wrong' : 'OK' },
      { field: 'Host Current', status: binaryArray[5] === '1' ? 'Fault' : 'OK' },
      { field: 'Air Filter', status: binaryArray[6] === '1' ? 'Blocked' : 'OK' },
      { field: 'Oil Separator', status: binaryArray[7] === '1' ? 'Blocked' : 'OK' },
      { field: 'Oil Filter', status: binaryArray[8] === '1' ? 'Blocked' : 'OK' },
      { field: 'Fan Current', status: binaryArray[9] === '1' ? 'Fault' : 'OK' },
      { field: 'Air Feed Pressure', status: binaryArray[14] === '1' ? 'High' : 'OK' },
      { field: 'Empty Long', status: binaryArray[15] === '1' ? 'Stop' : 'OK' },
      { field: 'Alarm', status: binaryArray2[0] === "1" ? "Alarm" : "OK" },
      { field: 'Pre-alarm', status: binaryArray2[1] === "1" ? "Pre-alarm" : "OK" },
      { field: 'Lube Grease Time', status: binaryArray2[3] === "1" ? "Up" : "OK" },
      { field: 'Lube Oil Time', status: binaryArray2[4] === "1" ? "Up" : "OK" },
      { field: 'Air Filter Time', status: binaryArray2[5] === "1" ? "Up" : "OK" },
      { field: 'Oil Separator Time', status: binaryArray2[6] === "1" ? "Up" : "OK" },
      { field: 'Oil Filter Time', status: binaryArray2[7] === "1" ? "Up" : "OK" },
      { field: 'Air Exhaust Temperature Sensor', status: binaryArray2[8] === "1" ? "High Pre-Alarm" : "OK" },
      { field: 'Water', status: binaryArray2[13] === "1" ? "Lacking" : "OK" },
      { field: 'Air Exhaust Temperature Sensor', status: binaryArray2[14] === "1" ? "Failure" : "OK" },
      { field: 'Air Feed Pressure Sensor', status: binaryArray2[15] === "1" ? "Failure" : "OK" }
    ];

    Object.keys(filteredData).forEach(key => {
      worksheet.addRow({ field: key, value: filteredData[key] });
    });

    statusArray.forEach(statusItem => {
      worksheet.addRow(statusItem);
    });

    worksheet.getCell('A1').font = { bold: true };
    worksheet.getCell('B1').font = { bold: true };
    worksheet.getCell('C1').font = { bold: true };

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const filePath = path.join(__dirname, 'data.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`Excel file created successfully: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error generating Excel file:', error);
  }
}

// Function to send email with attachment
function sendMail(to, subject, text, attachmentPath) {
  if (!fs.existsSync(attachmentPath)) {
    console.error(`Attachment file not found: ${attachmentPath}`);
    return;
  }

  transporter.sendMail({
    from: "ttpldevelopers@gmail.com",
    to: to,
    subject: subject,
    text: text,
    attachments: [
      {
        filename: 'data.xlsx',
        path: attachmentPath
      }
    ]
  }, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

// API endpoint to fetch the latest record and send the email
cron.schedule('0 18 * * *', async () => {
  try {
    const startTime = moment.tz('UTC').set({ hour: 11, minute: 30, second: 0, millisecond: 0 });
    const endTime = moment.tz('UTC').set({ hour: 12, minute: 45, second: 0, millisecond: 0 });

    const latestRecord = await MqttDataModel.findOne({
      "DateTime": {
        $gte: startTime.toDate(),
        $lte: endTime.toDate()
      }
    }).sort({ DateTime: -1 });

    if (latestRecord) {
      const runstate1 = latestRecord.RunState1;
      let binaryArray = runstate1 !== undefined
        ? runstate1.toString(2).padStart(16, '0').split('').reverse()
        : [];

      const runstate2 = latestRecord.RunState2;
      let binaryArray2 = runstate2 !== undefined
        ? runstate2.toString(2).padStart(16, '0').split('').reverse()
        : [];

      const filePath = await generateExcelFile(latestRecord, binaryArray, binaryArray2);
      const subject = "Latest Record Data";
      const text = "Please find the latest record data attached in Excel format.";

      sendMail("gajrajsingh.narde@raymond.in", subject, text, filePath);

      console.log('Email sent with latest record data.');
    } else {
      console.log('No records found between 10 PM and 10:30 PM GMT');
    }
  } catch (err) {
    console.error('Error fetching the latest record or sending email:', err);
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
