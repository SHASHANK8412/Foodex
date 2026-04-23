const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const generateShortId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const collection = mongoose.connection.collection("orders");
  const docs = await collection
    .find({
      $or: [{ shortId: null }, { shortId: { $exists: false } }],
    })
    .project({ _id: 1 })
    .toArray();

  let updated = 0;
  for (const doc of docs) {
    await collection.updateOne({ _id: doc._id }, { $set: { shortId: generateShortId() } });
    updated += 1;
  }

  console.log(`shortId backfilled: ${updated}`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
