const mongoose = require("mongoose");

const mqttDataSchema = new mongoose.Schema({
  imei: { type: String},
  uid: { type: Number },
  dtm: { type: String },
  seq: { type: Number },
  sig: { type: Number },
  msg: { type: String },
  sid: { type: Number },
  stat: { type: Number },
  rcnt: { type: Number },
  AirFeedPre: { type: Number },
  AirExstTemp: { type: Number },
  RunTime: { type: Number },
  LoadTime: { type: Number },
  HostAPhCur: { type: Number },
  Spare1: { type: Number },
  Spare2: { type: Number },
  RunState1: { type: Number },
  RunState2: { type: Number },
  ControlState: { type: Number},
  OilfilterT: { type: Number },
  OilSepTime: { type: Number },
  AirFiltTIme: { type: Number },
  LubeOilTime: { type: Number },
  LubeGreaseT: { type: Number },
});

const MqttDataModel = mongoose.model("MqttData", mqttDataSchema);

module.exports = MqttDataModel;
