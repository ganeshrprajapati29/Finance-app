import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI not found in environment');
  }

  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
  });

  await dropObsoleteIndexes();

  console.log('MongoDB connected successfully');
}

async function dropObsoleteIndexes() {
  try {
    const indexes = await mongoose.connection.db.collection('users').indexes();
    const hasUsernameIndex = indexes.some((index) => index.name === 'username_1');

    if (hasUsernameIndex) {
      await mongoose.connection.db.collection('users').dropIndex('username_1');
      console.log('Dropped obsolete users.username_1 index');
    }
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') {
      console.warn('Unable to check/drop obsolete users.username_1 index:', error.message);
    }
  }
}
