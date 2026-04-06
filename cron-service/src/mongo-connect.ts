import mongoose from 'mongoose'

let database: mongoose.Connection

export const connectDB = async () => {
  const uri: any = process.env.MONGO_URL
  if (database) {
    return
  }

  mongoose.connection.on('connected', () => {
    console.log({ actor: 'MongoDB' }, 'Connected to database')
  })

  mongoose.connection.on('disconnected', () => {
    console.log({ actor: 'MongoDB' }, 'Error connecting to database')
  })

  await mongoose.connect(uri)

  database = mongoose.connection
  console.log({ DB: database?.name }, 'Database Name')

}

export const disconnectDB = () => {
  if (!database) {
    return
  }
  mongoose.disconnect()
}