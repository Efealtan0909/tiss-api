const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

require('dotenv').config()
const express = require('express')
const app = express()
const expressWS = require('express-ws')(app)
const colors = require('colors');
const fs = require('fs')
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

app.post('/lockdown', async (req, res) => {
  if (!req.body || !req.body.code || req.body.active == undefined || req.body.active == null) {
    res.status(304).end()
    return
  }

  if (req.body.code != process.env.ADMINCODE) {
    res.status(304).end()
    return
  }

  if (req.body.active) {
    if (!fs.existsSync('.LOCKDOWN')) fs.writeFileSync('.LOCKDOWN', '')
  } else {
    if (fs.existsSync('.LOCKDOWN')) fs.rmSync('.LOCKDOWN')
  }

  expressWS.getWss().clients.forEach(async (client) => {
    if (req.body.active) {
      client.send(JSON.stringify({
        type: 'update',
        isOpen: false
      }))
      return
    }
    
    let door = await prisma.door.findUnique({
      where: {id: client.id}
    })

    client.send(JSON.stringify({
      type: 'update',
      isOpen: door.isOpen
    }))
  })

  res.end()
})

app.post('/door/:doorID/open', async (req, res) => {
  if (fs.existsSync('.LOCKDOWN')) {res.status(304).end()}

  if (!req.body || !req.body.code) {
    res.status(404).end()
    return
  }

  const doorID = parseInt(req.params.doorID)

  const door = await prisma.door.findUnique({
    where: {'id': doorID}
  })

  if (!door || req.body.code != process.env.ADMINCODE) {
    res.status(404).end()
    return
  }

  await prisma.door.update({
    where: {id: doorID},
    data: {isOpen: true}
  })

  expressWS.getWss().clients.forEach((client) => {
    if (client.id == doorID) {
      client.send(JSON.stringify({
        type: 'update',
        isOpen: true
      }))
    } 
  })

  res.end()
})

app.post('/door/:doorID/close', async (req, res) => {
  if (fs.existsSync('.LOCKDOWN')) {res.status(304).end()}
  if (!req.body || !req.body.code) {
    res.status(404).end()
    return
  }

  const doorID = parseInt(req.params.doorID)

  const door = await prisma.door.findUnique({
    where: {'id': doorID}
  })

  if (!door || req.body.code != process.env.ADMINCODE) {
    res.status(404).end()
    return
  }

  await prisma.door.update({
    where: {id: doorID},
    data: {isOpen: false}
  })

  expressWS.getWss().clients.forEach((client) => {
    if (client.id == doorID) {
      client.send(JSON.stringify({
        type: 'update',
        isOpen: false
      }))
    } 
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

        ws.id = message.id

        console.log(`[WS] Identified D${message.id}`.blue)

        if (fs.existsSync('.LOCKDOWN')) {
          ws.send(JSON.stringify({
            type: 'update',
            isOpen: false
          }))
          break
        }

        ws.send(JSON.stringify({
          type: 'update',
          isOpen: door.isOpen
        }))
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