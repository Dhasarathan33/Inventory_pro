import mongoose from 'mongoose'

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

function getMongoUri() {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('Please define the MONGODB_URI environment variable')
  }

  return mongoUri
}

function formatConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('querySrv')) {
    return new Error(
      'MongoDB SRV lookup failed. Use a local URI like mongodb://127.0.0.1:27017/inventory-management for local development, or verify Atlas DNS/network access.',
      { cause: error instanceof Error ? error : undefined }
    )
  }

  if (message.includes('ECONNREFUSED')) {
    return new Error(
      'MongoDB connection was refused. Ensure MongoDB is running and that MONGODB_URI points to a reachable server.',
      { cause: error instanceof Error ? error : undefined }
    )
  }

  return new Error(`MongoDB connection failed: ${message}`, {
    cause: error instanceof Error ? error : undefined,
  })
}

async function connectDB() {
  const mongoUri = getMongoUri()

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(mongoUri, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw formatConnectionError(e)
  }

  return cached.conn
}

export default connectDB
