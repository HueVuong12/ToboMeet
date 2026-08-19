import { MongoClient } from "mongodb";

async function main() {
  const uri = "mongodb://HNG209:29092004@ac-jsb242h-shard-00-00.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-01.djzrcmd.mongodb.net:27017,ac-jsb242h-shard-00-02.djzrcmd.mongodb.net:27017/tobomeet?ssl=true&replicaSet=atlas-3ju8k4-shard-0&authSource=admin";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("tobomeet");
    
    // 1. Tổng số phòng
    const totalRooms = await db.collection("rooms").countDocuments({});
    const activeRooms = await db.collection("rooms").countDocuments({ isDeleted: { $ne: true } });
    console.log(`\n=== PHÒNG ===`);
    console.log(`Tổng phòng: ${totalRooms}`);
    console.log(`Phòng active (isDeleted != true): ${activeRooms}`);

    // 2. Sample room để xem cấu trúc member
    const sampleRoom = await db.collection("rooms").findOne(
      { isDeleted: { $ne: true } },
      { projection: { name: 1, ownerId: 1, status: 1, "members": 1 } }
    );
    if (sampleRoom) {
      console.log(`\n=== SAMPLE ROOM: "${sampleRoom.name}" ===`);
      console.log(`  ownerId: ${sampleRoom.ownerId}`);
      console.log(`  room.status: ${sampleRoom.status}`);
      console.log(`  members count: ${sampleRoom.members?.length}`);
      sampleRoom.members?.forEach((m: any, i: number) => {
        if (i < 3) console.log(`  member[${i}]: userId=${m.userId}, role=${m.role}, status=${m.status}`);
      });
    }

    // 3. Phân bố member.status
    const pipeline: any[] = [
      { $unwind: "$members" },
      { $group: { _id: "$members.status", count: { $sum: 1 } } }
    ];
    const statusDist = await db.collection("rooms").aggregate(pipeline).toArray();
    console.log(`\n=== PHÂN BỔ member.status ===`);
    statusDist.forEach(s => console.log(`  status="${s._id}": ${s.count} members`));

    // 4. Hiển thị tất cả users
    const users = await db.collection("users").find({}).project({ email: 1, supabaseId: 1, displayName: 1 }).toArray();
    console.log(`\n=== USERS (${users.length}) ===`);
    users.forEach(u => {
      console.log(`  ${u.displayName || u.email}: supabaseId=${u.supabaseId}`);
    });

  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    await client.close();
  }
}

main();
