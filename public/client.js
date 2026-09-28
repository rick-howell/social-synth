socket = io()


class MyClient {
  constructor(){}
  
  
  make_interface(p){
    ///////////////////////////
    // Variable declarations //
    ///////////////////////////
    let dials = []
    const pMaxNos = 4
    let sgs, pNamIn, pNamBtn, idGame, yourIdx

    ///////////////////
    // Tone.js setup //
    ///////////////////
    let contextStarted = false
    let mySynth = new Tone.AMSynth().toDestination()
    mySynth.set({ "portamento": 0.1 })
    mySynth.oscillator.type = "fatsawtooth"
    mySynth.oscillator.spread = 20
    let beats = new Array(32)
    for (let i = 0; i < 32; i++){
      beats[i] = i
    }
    beats.forEach(function(b){
      Tone.Transport.schedule(function(time){
        mySynth.triggerAttackRelease(
          mu.mnn2pitch_simple(2*b + 36),
          "4n",
          time,
          p.random(0.3, 0.9)
        )
      }, "0:" + b + ":0")
    })
    Tone.Transport.bpm.value = 150
    Tone.Transport.loop = true
    Tone.Transport.loopEnd = "8m"


    /////////////////////
    // p5.js built-ins //
    /////////////////////
    p.setup = function(){

      p.createCanvas(400, 250)
      p.background(190)

      // Initialise dials.
      dials.push(
        new Dial(
          "Portamento",
          p.width/8,
          p.height/4,
          0, 0.75, 0.1
        ),
        new Dial(
          "Spread",
          3*p.width/8,
          p.height/4,
          0, 20, 20, 1
        ),
        new Dial(
          "Detune",
          5*p.width/8,
          p.height/4,
          -200, 200, 0, 10
        ),
        new Dial(
          "Volume",
          7*p.width/8,
          p.height/4,
          0, 1, 1
        )
      )
      dials[0].pair(mySynth, "portamento")
      dials[1].pair(mySynth, "spread")
      dials[2].pair(mySynth, "detune")
      dials[3].pair(mySynth, "volume")

      // Show inputs for player names etc.
      display_game_state()

    }


    p.touchStarted = function(){
      if (sgs === undefined){
        return
      }
      const relDial = dials.find(function(d){
        return d.touch_check()
      })
      // console.log("relDial:", relDial)
      if (relDial !== undefined){
        relDial.toggle_moving()
      }
      // return false
    }


    p.touchMoved = function(){
      if (sgs === undefined){
        return
      }
      const relDial = dials.find(function(d){
        return d.moving
      })
      if (relDial !== undefined){
        relDial.set_val()
        relDial.draw()
      }
      // return false
    }


    p.touchEnded = function(){
      if (sgs === undefined){
        return
      }
      const relDial = dials.find(function(d){
        return d.moving
      })
      if (relDial !== undefined){
        relDial.toggle_moving()
        if (sgs.turnIndex == yourIdx){
          update_game(relDial.id.toLowerCase())
        }
        else {
          alert("FYI, updates made out of turn aren't shared.")
        }
      }
      // return false
    }


    //////////////////
    // Server hooks //
    //////////////////
    function new_game(){
      // Check names have been entered.
      if (pNamIn[0].value() === "(Your name here)"){
        alert("Enter your name.")
        return false
      }
      if (pNamIn[1].value() === "(Collaborator 1)"){
        alert("Enter at least one collaborator.")
        return false
      }
      const cleanPlayerNames = pNamIn.map(function(inp){
        return inp.value().replace(/[^a-z0-9]/gi, "")
      })
      .filter(function(str){ return str !== ""})
      // console.log("cleanPlayerNames:", cleanPlayerNames)

      // Generate a game id.
      idGame = rand_alphanumeric(6)
      console.log("idGame:", idGame)

      const upData = {
        "idSocket": socket.id,
        "idGame": idGame,
        "cpn": cleanPlayerNames
      }

      fetch("/api/newGame", {
        method: "POST",
        body: JSON.stringify(upData),
        headers: { "Content-Type": "application/json" }
      })
      .then(response => response.json()) // parse the JSON from the server
      .then(data => {
        console.log("data:", data)
        sgs = data

        // Sign up for this room.
        // socket.emit("room", sgs.idGame)
        // console.log("Connected, done the sign up!")

        display_game_state()
      })
      .catch(function(err) {
        // Error :(
      })
    }


    function join_game(){
      console.log("idGame:", idGame)
      console.log("yourIdx:", yourIdx)
      fetch("/api/joinGame", {
        method: "post",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "idSocket": socket.id,
          "idGame": idGame,
          "playerIdx": yourIdx
        })
      })
      .then(response => response.json())
      .then(downData => {
        console.log("downData:", downData)
        if (downData.msg === "Game could not be identified. Server may have been refreshed."){
          alert(downData.msg)
        }
        else {
          // Sign up for this room.
          socket.emit("room", downData.idGame)
          console.log("Connected, done the sign up!")
          
          sgs = downData
          // Update the dials. This is only necessary if a player closes
          // the browser window then rejoins.
          // TODO(drum circle): synthProperties no longer exists; guarded until UI rewrite.
          if (sgs.synthProperties !== undefined){
            Object.keys(sgs.synthProperties).forEach(function(k, idx){
              dials[idx].val = sgs.synthProperties[k]
              dials[idx].set_pair_val()
            })
          }
          
          draw_components(dials, false)
        }
      })
      .catch(function(err) {
        // Error :(
      })
    }


    function update_game(str){
      // Collect current value of whatever was edited.
      const upData = {
        "idSocket": socket.id,
        "idGame": idGame,
        "idEdit": str,
        "val": dials.find(function(d){
          return d.id.toLowerCase() === str
        }).val
      }
      // Send game state to server.
      fetch("/api/updateGame", {
        method: "post",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(upData)
      })
      .then(response => response.json()) // parse the JSON from the server
      .then(downData => {
        console.log("downData:", downData)
        sgs = downData
        draw_components(dials, false)
      })
      .catch(function(err) {
        // Error :(
      })

    }


    socket.on("dial-assert", function(incom){
      console.log("Got to dial-assert.")
      sgs = incom
      console.log("sgs:", sgs)

      // Player 0 won't have had yourIdx set, so catch that and set it now.
      if (yourIdx === undefined){
        yourIdx = 0
      }

      // Update the dials.
      // TODO(drum circle): synthProperties no longer exists; guarded until UI rewrite.
      if (sgs.synthProperties !== undefined){
        Object.keys(sgs.synthProperties).forEach(function(k, idx){
          dials[idx].val = sgs.synthProperties[k]
          dials[idx].set_pair_val()
        })
      }

      draw_components(dials, false)

    })


    ///////////////
    // Utilities //
    ///////////////
    function draw_components(arr, attemptToJoinGame = true){
      p.background(190)

      if (
        sgs !== undefined &&
        sgs.players !== undefined &&
        sgs.players.every(function(player){
          return player.joined
        })
      ){
        // Draw dials.
        arr.forEach(function(c){
          c.draw()
        })

        // Draw play button.
        let button1 = p.createButton("Play annoying whole-tone scale!")
        const elemCoords = document.getElementById("lovelySketch").getBoundingClientRect()
        button1.position(
          elemCoords.x + 20 + button1.elt.getBoundingClientRect().width/2,
          window.scrollY + elemCoords.y + p.height/2
        )
        button1.mousePressed(toggle_play)
        button1.touchStarted(toggle_play)
      }

      display_game_state(attemptToJoinGame)
    }


    function display_game_state(attemptToJoinGame = true){
      // Begin logic!
      console.log("sgs:", sgs)
      // console.log("idGame:", idGame)
      // console.log("yourIdx:", yourIdx)

      // Get idGame and yourIdx if available.
      if (idGame === undefined){
        const idGameTentative = mu.get_parameter_by_name("g")
        if (idGameTentative !== null){
          idGame = idGameTentative
        }
      }
      if (yourIdx === undefined){
        const yourIdxTent = mu.get_parameter_by_name("p")
        if (yourIdxTent !== null){
          yourIdx = yourIdxTent
        }
      }
      console.log("idGame:", idGame, "yourIdx:", yourIdx)

      // Could try to catch and report faulty URL.
      // The problem with the code below is it fires at the start of a legit game too,
      // because idGame is populated when someone presses "Start!", so it's difficult to
      // dissociate from a faulty URL.
      // Also worth noting that the URL manipulation is basic, and doesn't remove any
      // existing query string when adding a new one.
      // if (
      //   (idGame === undefined || yourIdx === undefined) && // One of them's undefined
      //   !(idGame === undefined && yourIdx === undefined)   // but not both.
      // ){
      //   alert("URL missing game or player id. Let's start afresh.")
      // }

      // Join the game.
      if (attemptToJoinGame && idGame !== undefined && yourIdx !== undefined && sgs === undefined){
        console.log("Going to try to join the game!")
        join_game()
      }

      // Invitation screen.
      else if (sgs === undefined){
        // Make player name inputs.
        pNamIn = []
        const elemCoords = document.getElementById("lovelySketch").getBoundingClientRect()
        // console.log("elemCoords:", elemCoords)
        for (let i = 0; i < pMaxNos; i++){
          if (i === 0){
            pNamIn.push(p.createInput("(Your name here)"))
          }
          else if (i === 1){
            pNamIn.push(p.createInput("(Collaborator " + i + ")"))  
          }
          else {
            pNamIn.push(p.createInput(""))   
          }
          // Position relative to sketch.
          pNamIn[i].position(
            elemCoords.x + 50,
            window.scrollY + elemCoords.y + 10 + 25*i
          )
          // pNamIn[i].position(70, 25*i + 110)
        }
        // Make buttons.
        pNamBtn = []
        pNamIn.forEach(function(inp, idx){
          if (idx === 0){
            pNamBtn.push(
              p.createButton("Start!")
            )
            pNamBtn[idx].mousePressed(new_game)
          }
          else {
            pNamBtn.push(
              p.createButton("Invite")
            )
            pNamBtn[idx].attribute("disabled", "")
          }
          pNamBtn[idx].position(inp.x + inp.width, inp.y)
        })

      }

      // Waiting for all players to join.
      else if (
        sgs !== undefined &&
        sgs.players !== undefined &&
        !sgs.players.every(function(player){
          return player.joined
        })
      ){
        // Toggle the invite buttons.
        if (pNamIn !== undefined){
          pNamIn.forEach(function(inp){
            inp.attribute("disabled", "")
          })
          pNamBtn.forEach(function(btn, idx){
            if (idx === 0){
              btn.attribute("disabled", "")
            }
            else if (idx < sgs.players.length) {
              btn.removeAttribute("disabled")
              btn.mousePressed(function(){
                mu.copy_to_clipboard(
                  window.location.href + "?g=" + idGame + "&p=" + idx
                )
              })
            }
          })
        }
        else {
          // Display a notification.
          // Set appearance of text notification.
          p.textAlign(p.LEFT, p.CENTER)
          p.textSize(12)
          p.fill(220, 210, 220)
          p.noStroke()
          p.text("Waiting for all players to join.", 10, 20)
        }

      }

      // All players joined. Show the interface and whose go it is.
      else if (
        sgs !== undefined &&
        sgs.players !== undefined &&
        sgs.players.every(function(player){
          return player.joined
        })
      ){
        console.log("Removing form elements!")
        // Remove any form elements that may still be hanging around.
        if (pNamIn !== undefined){
          pNamIn.forEach(function(inp){
            inp.hide()
          })
          pNamBtn.forEach(function(btn, idx){
            btn.hide()
          }) 
        }

        // If this player started the game, make sure they have a helpful URL now for reloading the page if needs be.
        if (yourIdx === 0){
          if (window.history.pushState){
            const newURL = new URL(window.location.href)
            newURL.search = "?g=" + idGame + "&p=0"
            window.history.pushState({
              "path": newURL.href
            }, "", newURL.href)
          }
        }

        // Work out whose go it is, display appropriate notification.
        // Set appearance of text notification.
        p.textAlign(p.LEFT, p.CENTER)
        p.textSize(12)
        p.fill(220, 210, 220)
        p.noStroke()
        // TODO(drum circle): no turns any more; placeholder until UI rewrite.
        console.log("yourIdx:", yourIdx)
        p.text("Everyone's here: " + sgs.players.map(function(pl){ return pl.name }).join(", "), 10, 20)

      }

    }


    function toggle_play(){
      if (!contextStarted){
        Tone.start()
        contextStarted = true
      }

      if (Tone.Transport.state === "started"){
        Tone.Transport.stop()
      }
      else {
        Tone.Transport.start()
      }
      // Print a message!
      // p.textAlign(p.CENTER, p.CENTER)
      // p.textSize(16)
      // p.text("Oh gosh!", p.width/2, 8*p.height/10)
    }


    function rand_alphanumeric(len){
      // 48-57 encode 0-9, and 97-122 encode a-z.
      let outArr = new Array(len)
      for (let i = 0; i < len; i++){
        // Generate a random integer between 87 and 122. If it's less than 97, subtract 39 to get into the range 48-57.
        outArr[i] = 87 + Math.floor(36*Math.random())
        if (outArr[i] < 97){
          outArr[i] -= 39
        }
        outArr[i] = String.fromCharCode(outArr[i])
      }
      return outArr.join("")
    }


    /////////////
    // Classes //
    /////////////
    class Dial {
      constructor(_id, _x, _y, _min = 0, _max = 1, _val = 0.5, _step = null){
        this.id = _id
        this.x = _x
        this.y = _y
        this.min = _min
        this.max = _max
        this.val = _val
        this.step = _step
        this.gradations = null
        if (this.step !== null){
          let n = Math.floor((this.max - this.min)/this.step) + 1
          this.gradations = new Array(n)
          for (let i = 0; i < n; i++){
            this.gradations[i] = this.min + this.step*i
          }
        }
        // console.log("this.gradations:", this.gradations)

        // Pairing with Tone.js
        // this.toneObj = null
        // this.toneObjProperty = null

        // Defaults
        this.radius = 20
        p.colorMode(p.RGB, 255)
        this.bgCol = p.color(50, 55, 100)
        p.colorMode(p.HSB, 100)
        this.fgCol = p.color(50, 55, 100)
        this.moving = false
      }

      draw(){
        p.strokeWeight(3)
        p.stroke(this.fgCol)
        p.fill(this.bgCol)
        p.circle(this.x, this.y, 2*this.radius)
        p.stroke(100)
        p.line(this.x, this.y, this.x, this.y + this.radius)
        p.stroke(this.fgCol)
        const prop = (this.val - this.min)/(this.max - this.min)
        p.line(
          this.x,
          this.y,
          this.x + this.radius*p.cos(p.TWO_PI*prop - p.HALF_PI),
          this.y - this.radius*p.sin(p.TWO_PI*prop - p.HALF_PI)
        )
        let displayVal = this.val
        if (Math.round(this.val) !== this.val){
          displayVal = Math.round(100*this.val)/100
        }
        if (this.val >= 1000 || this.val <= -1000){
          displayVal = this.val.toExponential()
        }
        p.strokeWeight(3/5)
        p.stroke(100)
        p.noFill()
        p.textAlign(p.CENTER, p.BOTTOM)
        p.textSize(9)
        p.text(displayVal, this.x, this.y - 4)
        p.fill(this.bgCol)
        p.stroke(this.fgCol)
        p.textAlign(p.CENTER, p.CENTER)
        p.textSize(12)
        p.text(this.id, this.x, this.y + this.radius + 13)
      }

      
      pair(toneObj, toneObjProperty){
        this.toneObj = toneObj
        this.toneObjProperty = toneObjProperty
      }

      
      set_pair_val(){
        // console.log("this.val:", this.val)
        switch(this.toneObjProperty){
          case "volume":
          // console.log("dB:", 40*Math.log(this.val))
          this.toneObj[this.toneObjProperty].value = 40*Math.log(this.val)
          break
          case "portamento":
          this.toneObj[this.toneObjProperty] = this.val
          // const key = this.toneObjProperty
          // this.toneObj.set({
          //   key: this.val
          // })
          break
          case "spread":
          this.toneObj[this.toneObjProperty] = this.val
          break
          case "detune":
          this.toneObj[this.toneObjProperty].value = this.val
          break
          default:
          // Er?
        }

          // this.toneObj.set({
          //   toneObjProperty: this.val
          // })
      }

      
      set_val(){
        // Alpha is small +ve in first quadrant,
        // approaching +PI by end of second quadrant,
        // flips to -PI in third quadrant,
        // approaching small -ve by end of fourth quadrant.
        const alpha = p.atan2(
          this.y - p.mouseY,
          p.mouseX - this.x
        )
        // Beta is -PI in fourth quadrant,
        // approaching small -ve by end of first quadrant,
        // flips to small +ve in second quadrant,
        // approaching +PI by end of third quadrant.
        let beta
        if (alpha > -p.HALF_PI){
          beta = alpha - p.HALF_PI
        }
        else {
          beta = 3*p.PI/2 + alpha
        }
        // console.log("alpha:", alpha, "beta:", beta)
        const candidateVal = p.map(
          beta,
          -p.PI, p.PI,
          this.min, this.max
        )
        // Map the candidate value to the closest gradation,
        // if a step argument was provided when constructing
        // the dial.
        if (this.step !== null){
          const ma = mu.min_argmin(
            this.gradations.map(function(g){
              return Math.abs(g - candidateVal)
            })
          )
          this.val = this.gradations[ma[1]]
        }
        else {
          this.val = candidateVal
        }

        // If a Tone.js object property has been paired with
        // this dial, update the property on the Tone.js object.
        if (this.toneObj !== undefined && this.toneObjProperty !== undefined){
          this.set_pair_val()
        }
      }

      
      toggle_moving(){
        this.moving = !this.moving
      }

      
      touch_check(){
        return p.dist(
          p.mouseX, p.mouseY, this.x, this.y
        ) <= this.radius
      }
    }

  }

}
