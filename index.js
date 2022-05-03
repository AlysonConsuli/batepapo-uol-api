import express, { json } from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import joi from 'joi'
import { stripHtml } from 'string-strip-html'

const app = express()
app.use(cors())
app.use(json())
dotenv.config()

let db = null
const mongoClient = new MongoClient(process.env.MONGO_URI)
const promise = mongoClient.connect()
promise.then(() => db = mongoClient.db('uol'))

app.post('/participants', async (req, res) => {
    const participantSchema = joi.object({
        name: joi.string().required()
    })
    const { name } = req.body
    const validation = participantSchema.validate(req.body, { abortEarly: false })

    if (validation.error) {
        console.log(validation.error.details.map(detail => detail.message))
        return res.sendStatus(422)
    }
    try {
        const sanitizedName = stripHtml(name).result.trim()
        const participants = db.collection('participants')
        const messages = db.collection('messages')
        const nameConflict = await participants.findOne({ name: sanitizedName })
        if (nameConflict) {
            return res.sendStatus(409)
        }
        await participants.insertOne({
            name: sanitizedName,
            lastStatus: Date.now()
        })
        await messages.insertOne({
            from: sanitizedName,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.send({ name: sanitizedName }).status(201)
    } catch {
        res.sendStatus(500)
    }
})

app.get('/participants', async (req, res) => {
    try {
        const participantsCollection = db.collection('participants')
        const participants = await participantsCollection.find({}).toArray()
        res.send(participants)
    } catch {
        res.sendStatus(500)
    }
})

app.post('/messages', async (req, res) => {
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required(),
        from: joi.object({ name: joi.string().required() }).required()
    })
    const { to, text, type } = req.body
    const { user: from } = req.headers
    const participant = await db.collection('participants').findOne({ name: from })

    const validation = messageSchema.validate(
        { ...req.body, from: participant },
        { abortEarly: false, allowUnknown: true }
    )
    if (validation.error) {
        console.log(validation.error.details.map(detail => detail.message))
        return res.sendStatus(422)
    }

    try {
        const messages = db.collection('messages')
        await messages.insertOne({
            from: stripHtml(from).result.trim(),
            to: stripHtml(to).result.trim(),
            text: stripHtml(text).result.trim(),
            type: stripHtml(type).result.trim(),
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201)
    } catch {
        res.sendStatus(500)
    }
})

app.get('/messages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit)
        const { user: from } = req.headers
        const messagesCollection = db.collection('messages')
        const messages = await messagesCollection.find({
            $or: [
                { type: { $in: ['message', 'status'] } },
                { from },
                { to: from }
            ]
        }).toArray()
        if (limit) {
            const messagesLimit = messages.slice(limit * -1)
            res.send(messagesLimit)
        }
        (!limit && res.send(messages))
    } catch {
        res.sendStatus(500)
    }
})

app.post('/status', async (req, res) => {
    const { user } = req.headers
    const participants = db.collection('participants')
    const participant = await participants.findOne({ name: user })

    const statusSchema = joi.object({
        name: joi.string().required()
    })

    const validation = statusSchema.validate(
        participant,
        { abortEarly: false, allowUnknown: true }
    )
    if (validation.error) {
        console.log(validation.error.details.map(detail => detail.message))
        return res.sendStatus(404)
    }

    try {
        await participants.updateOne(
            { name: user },
            { $set: { lastStatus: Date.now() } }
        )
        res.sendStatus(200)
    } catch {
        res.sendStatus(500)
    }
})

app.delete('/messages/:messageId', async (req, res) => {
    try {
        const { user } = req.headers
        const { messageId } = req.params
        const messages = db.collection('messages')
        const message = await messages.findOne({ _id: new ObjectId(messageId) })
        if (!message) {
            return res.sendStatus(404)
        }
        if (user !== message.from) {
            return res.sendStatus(401)
        }
        await messages.deleteOne(message)
        res.sendStatus(200)
    } catch {
        res.sendStatus(500)
    }
})

app.put('/messages/:messageId', async (req, res) => {
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required(),
        from: joi.object({ name: joi.string().required() }).required()
    })
    const { user: from } = req.headers
    const participant = await db.collection('participants').findOne({ name: from })

    const validation = messageSchema.validate(
        { ...req.body, from: participant },
        { abortEarly: false, allowUnknown: true }
    )
    if (validation.error) {
        console.log(validation.error.details.map(detail => detail.message))
        return res.sendStatus(422)
    }

    try {
        const { messageId } = req.params
        const messages = db.collection('messages')
        const message = await messages.findOne({ _id: new ObjectId(messageId) })
        if (!message) {
            return res.sendStatus(404)
        }
        if (from !== message.from) {
            return res.sendStatus(401)
        }
        await messages.updateOne(message, { $set: req.body })
        res.sendStatus(200)
    } catch {
        res.sendStatus(500)
    }
})

setInterval(async () => {
    try {
        const participantsCollection = db.collection('participants')
        const participants = await participantsCollection.find({}).toArray()
        const messages = db.collection('messages')
        participants.forEach(async participant => {
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
        })
    } catch {
        console.log('Erro ao atualizar participantes ativos')
    }
}, 15000)

app.listen(5000, () => console.log('Server is running on: http://localhost:5000'))