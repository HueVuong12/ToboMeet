const mongoose = require("mongoose");
const connStr = "mongodb://HNG209:29092004@ac-jsb242h-shard-00-00.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-01.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-02.djzrcmd.mongodb.net:27017/tobomeet?ssl=true&replicaSet=atlas-3ju8k4-shard-0&authSource=admin";

async function run() {
  await mongoose.connect(connStr);
  const Room = mongoose.model("Room", new mongoose.Schema({ name: String, status: String, isDeleted: Boolean }, { timestamps: true }));
  const disbandedRooms = await Room.find({ $or: [{ status: "disbanded" }, { isDeleted: true }] });
  console.log("Phong bi khoa/giai tan:", disbandedRooms.map(r => ({ id: r._id, name: r.name, status: r.status, isDeleted: r.isDeleted })));
  
  if (disbandedRooms.length > 0) {
    await Room.updateMany({ _id: { $in: disbandedRooms.map(r => r._id) } }, { $set: { status: "active", isDeleted: false } });
    console.log("DA_KHOI_PHUC_THANH_CONG");
  }
  await mongoose.disconnect();
}

run();
