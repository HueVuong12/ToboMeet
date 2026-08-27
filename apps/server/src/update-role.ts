import { MongoClient } from "mongodb";

async function main() {
  const uri = "mongodb://HNG209:29092004@ac-jsb242h-shard-00-00.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-01.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-02.djzrcmd.mongodb.net:27017/tobomeet?ssl=true&replicaSet=atlas-3ju8k4-shard-0&authSource=admin";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("tobomeet");
    const result = await db.collection("users").updateOne(
      { email: "ngochuevuong12@gmail.com" },
      { $set: { role: "admin", status: "active" } }
    );
    console.log(`Đã cập nhật role admin cho ngochuevuong12@gmail.com. Số bản ghi cập nhật: ${result.modifiedCount}`);
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    await client.close();
  }
}

main();
