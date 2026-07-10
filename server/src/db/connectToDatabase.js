import mongoose from 'mongoose'

const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/codearena'
let memoryServer

export async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI

  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
  } catch (error) {
    if (process.env.MONGODB_URI) {
      throw error
    }

    console.warn('Local MongoDB unavailable, starting in-memory dev database')

    const { MongoMemoryServer } = await import('mongodb-memory-server')
    memoryServer = await MongoMemoryServer.create()

    await mongoose.connect(memoryServer.getUri(), {
      serverSelectionTimeoutMS: 5000,
    })
  }

  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}
