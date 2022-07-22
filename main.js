const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

require('dotenv').config()
const express = require('express')
const app = express()
const expressWS = require('express-ws')(app)
const colors = require('colors');
const expressWs = require('express-ws')
const PORT = 8949

app.use(express.json())

prisma.$connect()

app.get('/door/:doorID', async (req, res) => {
  const door = await prisma.door.findUnique({
    where: {id: parseInt(req.params.doorID)}
  })

  if (!door) {
    res.status(404).end()
    return
  }

  res.send(door)
})

app.post('/door/:doorID/lock', async (req, res) => {
  if (!req.body || !req.body.code) {
    res.status(404).end()
    return
  }

  const doorID = parseInt(req.params.doorID)

  const door = await prisma.door.findUnique({
    where: {id: doorID}
  })

  if (!door || req.body.code != process.env.ADMINCODE) {
    res.status(404).end()
    return
  }

  if (door.isLocked) {res.end(); return}

  await prisma.door.update({
    where: {id: doorID},
    data: {isLocked: true}
  })

  expressWS.getWss().clients.forEach((client) => {
    client.send(JSON.stringify({
      type: 'isLocked:UPDATE',
      isLocked: true
    }))
  })

  res.end()
})

app.post('/door/:doorID/unlock', async (req, res) => {
  if (!req.body || !req.body.code) {
    res.status(404).end()
    return
  }

  const doorID = parseInt(req.params.doorID)

  const door = await prisma.door.findUnique({
    where: {id: doorID}
  })

  if (!door || req.body.code != process.env.ADMINCODE) {
    res.status(404).end()
    return
  }

  if (!door.isLocked) {res.end(); return}

  await prisma.door.update({
    where: {id: doorID},
    data: {isLocked: false}
  })

  expressWS.getWss().clients.forEach((client) => {
    client.send(JSON.stringify({
      type: 'isLocked:UPDATE',
      isLocked: false
    }))
  })

  res.end()
})

app.post('/door/:doorID/open', async (req, res) => {
  const doorID = parseInt(req.params.doorID)

  const door = await prisma.door.findUnique({
    where: {'id': doorID}
  })

  if (!door) {
    res.status(404).end()
    return
  }

  if (door.isLocked) {
    res.status(304).end()
    return
  }

  if (door.isOpen) {res.end(); return}

  await prisma.door.update({
    where: {id: doorID},
    data: {isOpen: true}
  })

  expressWS.getWss().clients.forEach((client) => {
    client.send(JSON.stringify({
      type: 'isOpen:UPDATE',
      isOpen: true
    }))
  })

  res.end()
})

app.post('/door/:doorID/close', async (req, res) => {
  const doorID = parseInt(req.params.doorID)

  const door = await prisma.door.findUnique({
    where: {'id': doorID}
  })

  if (!door) {
    res.status(404).end()
    return
  }

  if (door.isLocked) {
    res.status(304).end()
    return
  }

  if (!door.isOpen) {res.end(); return}

  await prisma.door.update({
    where: {id: doorID},
    data: {isOpen: false}
  })

  expressWS.getWss().clients.forEach((client) => {
    client.send(JSON.stringify({
      type: 'isOpen:UPDATE',
      isOpen: false
    }))
  })

  res.end()
})

app.ws('/doorController', async (ws, req) => {
  ws.on('message', async (message) => {
    try {
      message = JSON.parse(message)
    } catch {
      console.log(message)
      return
    }
    
    switch (message.type) {
      case 'identify':
        const door = await prisma.door.findUnique({
          where: {'id': message.id}
        })
        
        if (!door) {
          ws.send(JSON.stringify({
            type: 'identify:ERROR',
            error: 404
          }))
          return
        }

        console.log(`[WS:IDENTIFIY] ${message.id}`.blue)
        break
    }
  })
  ws.send(JSON.stringify({
    type: "identify"
  }))
})

app.listen(PORT, async () => {
  await prisma.$connect()
  console.log("API RUNNING")
})