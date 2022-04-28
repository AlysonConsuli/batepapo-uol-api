import express, { json } from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

const app = express()
app.use(cors())
app.use(json())
dotenv.config()

let db = null
const mongoClient = new MongoClient(process.env.MONGO_URI)

app.get('/', (req, res) => {
    res.send('Server is running on: http://localhost:5000')
})

app.post('/participants', async (req, res) => {
    try {
        const { name } = req.body
        await mongoClient.connect()
        db = mongoClient.db("uol")
        const participants = db.collection('participants')
        await participants.insertOne({ name })
        res.status(201).send('Created')
        mongoClient.close()
    } catch {
        res.status(400).send('Erro')
        mongoClient.close()
    }
})

app.get('/participants', async (req, res) => {
    try {
        await mongoClient.connect()
        db = mongoClient.db("uol")
        const participantsCollection = db.collection('participants')
        const participants = await participantsCollection.find({}).toArray()
        res.status(200).send(participants)
        mongoClient.close()
    } catch {
        res.status(400).send('Erro')
        mongoClient.close()
    }
})

app.listen(5000, () => console.log('Server is running on: http://localhost:5000'))