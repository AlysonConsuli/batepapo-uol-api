import express, { json } from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv, { parse } from 'dotenv'
import dayjs from 'dayjs'

const app = express()
app.use(cors())
app.use(json())
dotenv.config()

let db = null
const mongoClient = new MongoClient(process.env.MONGO_URI)

app.post('/participants', async (req, res) => {
    try {
        const { name } = req.body
        await mongoClient.connect()
        db = mongoClient.db('uol')
        const participants = db.collection('participants')
        const messages = db.collection('messages')
        await participants.insertOne({
            name,
            lastStatus: Date.now()
        })
        await messages.insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
        mongoClient.close()
    } catch {
        res.status(400).send('Erro')
        mongoClient.close()
    }
})

app.get('/participants', async (req, res) => {
    try {
        await mongoClient.connect()
        db = mongoClient.db('uol')
        const participantsCollection = db.collection('participants')
        const participants = await participantsCollection.find({}).toArray()
        res.send(participants)
        mongoClient.close()
    } catch {
        res.status(400).send('Erro')
        mongoClient.close()
    }
})

app.post('/messages', async (req, res) => {
    try {
        const { to, text, type } = req.body
        const { user: from } = req.headers
        await mongoClient.connect()
        db = mongoClient.db('uol')
        const messages = db.collection('messages')
        await messages.insertOne({
            from,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
        mongoClient.close()
    } catch {
        res.status(400).send('Erro')
        mongoClient.close()
    }
})

app.get('/messages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)
        const { user: from } = req.headers
        await mongoClient.connect()
        db = mongoClient.db('uol')
        const messagesCollection = db.collection('messages')
        //const messages = await messagesCollection.find({ to: { $in: ['Todos', 'Teste'] } }).toArray()
        const messages = await messagesCollection.find({}).toArray()
        if (limit) {
            const messagesLimit = messages.slice(limit * -1)
            res.send(messagesLimit)
        }
        (!limit && res.send(messages))
        mongoClient.close()
    } catch {
        res.status(400).send('Erro')
        mongoClient.close()
    }
})

app.listen(5000, () => console.log('Server is running on: http://localhost:5000'))