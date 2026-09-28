/**
 * Main Node.js server script for Social Synth - Drum Circle Edition.
 */

const path = require("path")
const fastify = require("fastify")({ logger: false })

fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public"),
  prefix: "/"
})

fastify.register(require("point-of-view"), {
  engine: {
    handlebars: require("handlebars")
  }
})

fastify.register(require("fastify-socket.io"))

fastify.get("/", function(req, rep){
  rep.view("/src/pages/index.html")
})

const GameState = require("./game_state")
const gameState = new GameState()
const allGames = {}
const idToSocket = {}

fastify.ready(err => {
  if (err) throw err

  fastify.io.on("connection", socket => {
    console.log("socket.id:", socket.id)
    idToSocket[socket.id] = socket

    socket.on("disconnect", function(){
      delete idToSocket[socket.id]
    })

    socket.on("room", id => {
      console.log("Room id:", id)
      socket.join(id)
      const cg = allGames[id]
      if (cg) {
        fastify.io.to(id).emit("dial-assert", cg)
      }
    })
  })
})

fastify.post("/api/newGame", function(req, rep){
  const idSocket = req.body.idSocket
  const idGame = req.body.idGame
  if (!idSocket || !idGame){
    rep.code(404).send()
    return
  }
  if (idToSocket[idSocket]) {
    idToSocket[idSocket].join(idGame)
  }
  allGames[idGame] = gameState.make_game()
  allGames[idGame]["idGame"] = idGame
  const cg = allGames[idGame]

  req.body.cpn.forEach(function(pn, idx){
    gameState.make_player(cg, pn, idx === 0)
  })

  rep.send(cg)
})

fastify.post("/api/joinGame", function(req, rep){
  const idSocket = req.body.idSocket
  const idGame = req.body.idGame
  const playerIdx = req.body.playerIdx
  if (idSocket === null || idGame === null || playerIdx === null){
    rep.code(404).send()
    return
  }
  const cg = allGames[idGame]
  if (cg === undefined){
    rep.send({
      "msg": "Game could not be identified. Server may have been refreshed."
    })
    return
  }

  cg.players[playerIdx].joined = true

  // Notify everyone in the room
  fastify.io.to(idGame).emit("dial-assert", cg)
  rep.send(cg)
})

// Updates one player's 16-step drum lane
fastify.post("/api/updateSteps", function(req, rep){
  const { idSocket, idGame, playerIdx, steps } = req.body
  if (idSocket === null || idGame === null || playerIdx === null || !steps){
    rep.code(404).send()
    return
  }
  const cg = allGames[idGame]
  if (cg === undefined){
    rep.send({ "msg": "Game could not be identified." })
    return
  }

  const ok = gameState.update_steps(cg, playerIdx, steps)
  if (!ok){
    rep.code(400).send({ "msg": "Could not update steps." })
    return
  }

  // Broadcast updated game state to all players in the room
  fastify.io.to(idGame).emit("dial-assert", cg)
  rep.send(cg)
})

// Updates BPM and swing (Only Player 0 / bpmOwnerIdx can do this)
fastify.post("/api/updateTransport", function(req, rep){
  const { idSocket, idGame, playerIdx, bpm, swing } = req.body
  if (idSocket === null || idGame === null || playerIdx === null){
    rep.code(404).send()
    return
  }
  const cg = allGames[idGame]
  if (cg === undefined){
    rep.send({ "msg": "Game could not be identified." })
    return
  }

  const ok = gameState.update_transport(cg, playerIdx, bpm, swing)
  if (!ok){
    rep.code(403).send({ "msg": "Only player 0 can set BPM/swing." })
    return
  }

  // Broadcast update to room
  fastify.io.to(idGame).emit("dial-assert", cg)
  rep.send(cg)
})

const PORT = process.env.PORT || 3000
fastify.listen({ port: PORT, host: "0.0.0.0" }, function(err, address){
  if (err){
    fastify.log.error(err)
    process.exit(1)
  }
  console.log(`Drum circle server running at ${address}`)
})