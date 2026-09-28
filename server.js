/**
 * This is the main Node.js server script for the project.
 */

const path = require("path")

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging.
  logger: false
})

// Setup our static files.
fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public"),
  prefix: "/"
})

// point-of-view is a templating manager for Fastify.
fastify.register(require("point-of-view"), {
  engine: {
    handlebars: require("handlebars")
  }
})

fastify.register(require("fastify-socket.io"))
// fastify.register(require("fastify-socket.io"), {
//   cors: {
//     origin: "*",
//     credentials: true
//   }
// })
// From Wikipedia: "Cross-origin resource sharing (CORS) is a mechanism that allows restricted resources on a web page to be requested from another domain outside the domain"
// For this project at least, it does not matter whether you specify the above cors options or not.

// Load and parse SEO data if you want to.
// const seo = require("./src/seo.json")
// if (seo.url === "glitch-default") {
//   seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`
// }

/**
 * Home page route
 */
fastify.get("/", function(req, rep){
  rep.view("/src/pages/index.html")
  // rep.view("/views/index.html")
  // The Handlebars code will be able to access the parameter values and build them into the page
  // params is an object that can be passed to the Handlebars template.
  // let params = { seo: seo }
  // reply.view("/src/pages/index.hbs", params)
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
    console.log("Object.keys(idToSocket):", Object.keys(idToSocket))
    fastify.io.on("disconnect", function(){
      delete idToSocket[socket.id]
    })

    socket.on("room", id => {
      console.log("Room id:", id)
      idToSocket[socket.id].join(id)
      // socket.join(id)
      const cg = allGames[id]
      idToSocket[socket.id].to(id).emit("dial-assert", cg)
    })
  })
})


fastify.post("/api/newGame", function(req, rep){
  console.log("req.body:", req.body)
  const idSocket = req.body.idSocket
  const idGame = req.body.idGame
  if (idSocket === null || idGame === null){
    rep.code(404).send()
    return
  }
  idToSocket[idSocket].join(idGame)
  allGames[idGame] = gameState.make_game()
  allGames[idGame]["idGame"] = idGame
  console.log("allGames[idGame]:", allGames[idGame])
  const cg = allGames[idGame]
  req.body.cpn.forEach(function(pn, idx){
    console.log("Adding player:", idx)
    gameState.make_player(cg, pn, idx === 0)
  })

  rep.send(cg)
})


fastify.post("/api/joinGame", function(req, rep){
  console.log("req.body:", req.body)
  const idSocket = req.body.idSocket
  const idGame = req.body.idGame
  const playerIdx = req.body.playerIdx
  if (idSocket === null || idGame === null || playerIdx === null){
    rep.code(404).send()
    return
  }
  const cg = allGames[idGame]
  console.log("cg:", cg)
  if (cg === undefined){
    rep.send({
      "msg": "Game could not be identified. Server may have been refreshed."
    })
    return
  }
  // This join() and the following emit() have to be handled by socket.on(),
  // because of the instantaneous nature of joining in this project.
  // idToSocket[idSocket].join(idGame)

  // Switch the join attribute for incoming player to true.
  cg.players[playerIdx].joined = true

  // Tell all clients in room idGame about the new player.
  // idToSocket[idSocket].to(idGame).emit("dial-assert", cg)

  rep.send(cg)
})


// Updates one player's own 16-step lane. Any joined player may edit their
// own lane at any time - there's no turn order in the drum circle, so
// everyone's steps can change independently and simultaneously.
fastify.post("/api/updateSteps", function(req, rep){
  console.log("req.body:", req.body)
  const idSocket = req.body.idSocket
  const idGame = req.body.idGame
  const playerIdx = req.body.playerIdx
  const steps = req.body.steps
  if (idSocket === null || idGame === null || playerIdx === null || steps === null){
    rep.code(404).send()
    return
  }
  const cg = allGames[idGame]
  console.log("cg:", cg)
  if (cg === undefined){
    rep.send({
      "msg": "Game could not be identified. Server may have been refreshed."
    })
    return
  }

  const ok = gameState.update_steps(cg, playerIdx, steps)
  if (!ok){
    rep.code(400).send({ "msg": "Could not update steps." })
    return
  }

  // Tell all clients in room idGame about the update.
  idToSocket[idSocket].to(idGame).emit("dial-assert", cg)
  rep.send(cg)
})


// Updates the shared bpm/swing. Only the game's bpmOwnerIdx (the player who
// started the game) is allowed to do this - gameState.update_transport()
// enforces that and returns false if some other player tries.
fastify.post("/api/updateTransport", function(req, rep){
  console.log("req.body:", req.body)
  const idSocket = req.body.idSocket
  const idGame = req.body.idGame
  const playerIdx = req.body.playerIdx
  const bpm = req.body.bpm
  const swing = req.body.swing
  if (idSocket === null || idGame === null || playerIdx === null){
    rep.code(404).send()
    return
  }
  const cg = allGames[idGame]
  console.log("cg:", cg)
  if (cg === undefined){
    rep.send({
      "msg": "Game could not be identified. Server may have been refreshed."
    })
    return
  }

  const ok = gameState.update_transport(cg, playerIdx, bpm, swing)
  if (!ok){
    rep.code(403).send({ "msg": "Only the player who started the game can set bpm/swing." })
    return
  }

  // Tell all clients in room idGame about the update.
  idToSocket[idSocket].to(idGame).emit("dial-assert", cg)
  rep.send(cg)
})


// Run the server and report out to the logs.
const PORT = process.env.PORT || 3000;
fastify.listen({ port: PORT, host: "0.0.0.0" }, function(err, address){
  if (err){
    fastify.log.error(err)
    process.exit(1)
  }
  console.log(`Your app is listening on ${address}`)
  fastify.log.info(`server listening on ${address}`)
})
