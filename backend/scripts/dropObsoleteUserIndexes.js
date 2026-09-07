import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
dotenv.config({ path: './src/.env', override: false });

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI not found in environment');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const users = mongoose.connection.db.collection('users');
  const indexes = await users.indexes();
  const obsoleteIndexes = ['username_1'];

  for (const indexName of obsoleteIndexes) {
    if (indexes.some((index) => index.name === indexName)) {
      await users.dropIndex(indexName);
      console.log(`Dropped obsolete users.${indexName} index`);
    } else {
      console.log(`users.${indexName} index not found`);
    }
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
