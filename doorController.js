const WebSocket = require('ws')

const ws = new WebSocket("ws://localhost:8949/doorController")

ws.on('open', ()  => {
  console.log('OPENED')
})

ws.on('message', (message) => {
  message = JSON.parse(message)
  console.log(message)

  switch (message.type) {
    case 'identify': 
      ws.send(JSON.stringify({
        type: 'identify',
        id: 1
      }))
  }
})