import mongoose from 'mongoose'

const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/codearena'

export async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI

  mongoose.set('strictQuery', true)

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  })

  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}
