import express, { json } from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'

const app = express()
app.use(cors())
app.use(json())
dotenv.config()

let db = null
const mongoClient = new MongoClient(process.env.MONGO_URI)
const promise = mongoClient.connect()
promise.then(() => db = mongoClient.db('uol'))

app.post('/participants', async (req, res) => {
    try {
        const { name } = req.body
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
    } catch {
        res.status(400).send('Erro')
    }
})

app.get('/participants', async (req, res) => {
    try {
        const participantsCollection = db.collection('participants')
        const participants = await participantsCollection.find({}).toArray()
        res.send(participants)
    } catch {
        res.status(400).send('Erro')
    }
})

app.post('/messages', async (req, res) => {
    try {
        const { to, text, type } = req.body
        const { user: from } = req.headers
        const messages = db.collection('messages')
        await messages.insertOne({
            from,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
    } catch {
        res.status(400).send('Erro')
    }
})

app.get('/messages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)
        const { user: from } = req.headers
        const messagesCollection = db.collection('messages')
        //const messages = await messagesCollection.find({ to: { $in: ['Todos', 'Teste'] } }).toArray()
        const messages = await messagesCollection.find({}).toArray()
        if (limit) {
            const messagesLimit = messages.slice(limit * -1)
            res.send(messagesLimit)
        }
        (!limit && res.send(messages))
    } catch {
        res.status(400).send('Erro')
    }
})

app.post('/status', async (req, res) => {
    try {
        const { user } = req.headers
        const participants = db.collection('participants')
        //const participant = await participants.findOne({ name: user })
        await participants.updateOne(
            { name: user },
            { $set: { lastStatus: Date.now() } }
        )
        res.sendStatus(200)
    } catch {
        res.status(400).send('Erro')
    }
})

setInterval(async () => {
    try {
        const participantsCollection = db.collection('participants')
        const participants = await participantsCollection.find({}).toArray()
        const messages = db.collection('messages')
        for (let i = 0; i < participants.length; i++) {
            const participant = participants[i]
            if (Date.now() - participant.lastStatus > 10000) {
                await participantsCollection.deleteOne({ _id: participant._id })
                await messages.insertOne({
                    from: participant.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                })
            }
        }
        //console.log('Remove users inactive')
    } catch {
        console.log('Erro')
    }
}, 15000)

app.listen(5000, () => console.log('Server is running on: http://localhost:5000'))