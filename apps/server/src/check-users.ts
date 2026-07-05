import { MongoClient } from "mongodb";

async function main() {
  const uri = "mongodb://HNG209:29092004@ac-jsb242h-shard-00-00.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-01.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-02.djzrcmd.mongodb.net:27017/tobomeet?ssl=true&replicaSet=atlas-3ju8k4-shard-0&authSource=admin";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("tobomeet");
    const users = await db.collection("users").find({}).toArray();
    console.log("=== DANH SÁCH USER TRONG MONGODB ===");
    users.forEach(u => {
      console.log(`Email: ${u.email}, Role: ${u.role}, Status: ${u.status}, SupabaseId: ${u.supabaseId}`);
    });
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    await client.close();
  }
}

main();
