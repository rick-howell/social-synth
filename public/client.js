socket = io()

class MyClient {
  constructor(){}

  make_interface(p){
    ///////////////////////////
    // Variable declarations //
    ///////////////////////////
    let sgs, idGame, yourIdx
    const pMaxNos = 4
    let pNamIn = []
    let pNamBtn = []

    // Tone.js & Audio state
    let contextStarted = false
    const playerSynths = []
    let currentStep = 0

    // DOM Controls for game state
    let playBtn, bpmSlider, swingSlider, updateTransportBtn
    let controlsCreated = false

    ///////////////////
    // Tone.js setup //
    ///////////////////
    Tone.Transport.bpm.value = 100
    Tone.Transport.swingSubdivision = "16n"

    // 16-step loop scheduler
    Tone.Transport.scheduleRepeat((time) => {
      if (!sgs || !sgs.players) return

      sgs.players.forEach((player, idx) => {
        if (player.joined && player.steps && player.steps[currentStep] && playerSynths[idx]) {
          const pitchNote = Tone.Frequency(player.voice.pitch, "midi").toNote()
          playerSynths[idx].triggerAttackRelease(pitchNote, "16n", time)
        }
      })

      // Advance visual playhead (0 to 15)
      currentStep = (currentStep + 1) % 16
    }, "16n")

    function syncPlayerSynths() {
      if (!sgs || !sgs.players) return

      sgs.players.forEach((player, idx) => {
        if (player.joined && !playerSynths[idx] && player.voice) {
          const v = player.voice
          const synth = new Tone.FMSynth({
            harmonicity: v.harmonicity,
            modulationIndex: v.modulationIndex,
            oscillator: { type: v.oscillatorType },
            modulation: { type: v.modulationType },
            envelope: v.envelope,
            modulationEnvelope: v.modulationEnvelope
          }).toDestination()

          playerSynths[idx] = synth
        }
      })
    }

    /////////////////////
    // p5.js Built-ins //
    /////////////////////
    p.setup = function(){
      p.createCanvas(720, 420)
      p.background(30)

      display_game_state()
    }

    p.draw = function(){
      p.background(30)

      if (sgs === undefined) {
        // STATE 1: Initial setup / Name input screen
        p.colorMode(p.RGB, 255)
        p.fill(240)
        p.noStroke()
        p.textAlign(p.LEFT, p.TOP)
        p.textSize(20)
        p.text("Social Synth — Drum Circle", 30, 25)
        p.textSize(13)
        p.fill(180)
        p.text("Enter your name and collaborator names to start a session:", 30, 60)
      } 
      else if (sgs && sgs.players && !sgs.players.every(pl => pl.joined)) {
        // STATE 2: Waiting for collaborators to join
        p.colorMode(p.RGB, 255)
        p.fill(240)
        p.noStroke()
        p.textAlign(p.LEFT, p.TOP)
        p.textSize(20)
        p.text("Social Synth — Drum Circle", 30, 25)
        
        p.textSize(14)
        p.fill(220, 200, 100)
        p.text("Waiting for all players to join...", 30, 65)

        p.textSize(12)
        p.fill(170)
        p.text("Click the 'Invite' buttons below to copy invite links for your collaborators.", 30, 240)
      } 
      else if (sgs && sgs.players && sgs.players.every(pl => pl.joined)) {
        // STATE 3: Game in progress — draw sequencer
        draw_sequencer()
      }
    }

    p.mousePressed = function(){
      if (!sgs || !sgs.players || !sgs.players.every(pl => pl.joined)) return
      if (yourIdx === undefined) return

      const laneStartY = 110
      const laneHeight = 65
      const gridX = 140
      const stepWidth = 32
      const stepHeight = 40

      const myLaneY = laneStartY + Number(yourIdx) * laneHeight

      if (p.mouseY >= myLaneY + 15 && p.mouseY <= myLaneY + 15 + stepHeight) {
        if (p.mouseX >= gridX && p.mouseX < gridX + 16 * stepWidth) {
          const stepClicked = Math.floor((p.mouseX - gridX) / stepWidth)

          // Toggle step locally
          sgs.players[yourIdx].steps[stepClicked] = !sgs.players[yourIdx].steps[stepClicked]

          // Sync with server via POST
          fetch("/api/updateSteps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idSocket: socket.id,
              idGame: idGame,
              playerIdx: Number(yourIdx),
              steps: sgs.players[yourIdx].steps
            })
          })
          .then(res => res.json())
          .then(data => { 
            if (data && data.players) sgs = data 
          })
          .catch(err => console.error("Error updating steps:", err))
        }
      }
    }

    ///////////////////
    // UI Rendering  //
    ///////////////////
    function draw_sequencer(){
      p.colorMode(p.RGB, 255)

      // Header
      p.fill(255)
      p.noStroke()
      p.textSize(18)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Drum Circle — Room: ${idGame}`, 20, 15)

      p.textSize(12)
      p.fill(180)
      const isHost = Number(yourIdx) === 0
      p.text(isHost ? "You are the Host (Tempo Control)" : "Tempo set by Host", 20, 40)

      // Draw Slider Labels for Host (positioned directly under sliders)
      if (isHost && bpmSlider && swingSlider) {
        p.fill(220)
        p.noStroke()
        p.textAlign(p.CENTER, p.TOP)
        p.textSize(11)
        p.text(`BPM: ${bpmSlider.value()}`, 335, 36)
        p.text(`SWING: ${Math.round(swingSlider.value() * 100)}%`, 335, 76)
      } else if (!isHost) {
        p.fill(220)
        p.noStroke()
        p.textAlign(p.LEFT, p.TOP)
        p.textSize(12)
        p.text(`BPM: ${sgs.bpm || 100}  |  SWING: ${Math.round((sgs.swing || 0) * 100)}%`, 280, 25)
      }

      // Render Player Lanes
      const laneStartY = 110
      const laneHeight = 65
      const gridX = 140
      const stepWidth = 32
      const stepHeight = 40

      sgs.players.forEach((player, pIdx) => {
        const y = laneStartY + pIdx * laneHeight

        // Color indicator and Name tag
        p.colorMode(p.HSB, 360, 100, 100, 1)
        p.fill(player.voice.hue, 70, 90)
        p.rect(20, y + 15, 10, stepHeight, 3)

        p.colorMode(p.RGB, 255)
        p.fill(220)
        p.textAlign(p.LEFT, p.CENTER)
        p.textSize(13)
        const isYou = pIdx === Number(yourIdx) ? " (You)" : ""
        p.text(`${player.name}${isYou}`, 38, y + 35)

        // Draw 16 steps
        for (let s = 0; s < 16; s++) {
          const x = gridX + s * stepWidth
          const isActive = player.steps[s]
          const isCurrentStep = (s === (currentStep === 0 ? 15 : currentStep - 1)) && Tone.Transport.state === "started"

          // Reset color mode and stroke parameters at the start of every step
          p.colorMode(p.RGB, 255)
          p.stroke(50)
          p.strokeWeight(1)

          if (isActive) {
            p.colorMode(p.HSB, 360, 100, 100, 1)
            p.fill(player.voice.hue, 80, 85)
          } else {
            p.fill(s % 4 === 0 ? 55 : 40)
          }

          if (isCurrentStep) {
            p.colorMode(p.RGB, 255)
            p.stroke(255, 255, 0)
            p.strokeWeight(2)
          }

          p.rect(x + 2, y + 15, stepWidth - 4, stepHeight, 4)
        }

        // Transparency rectangle overlay over other players' lanes
        if (pIdx !== Number(yourIdx)) {
          p.colorMode(p.RGB, 255)
          p.fill(20, 20, 20, 160)
          p.noStroke()
          p.rect(gridX - 5, y + 10, 16 * stepWidth + 10, stepHeight + 10, 6)
        }
      })
    }

    //////////////////
    // Server Hooks //
    //////////////////
    function new_game(){
      if (!pNamIn[0] || pNamIn[0].value() === "(Your name here)" || pNamIn[0].value().trim() === ""){
        alert("Enter your name.")
        return
      }
      const cleanPlayerNames = pNamIn.map(inp => inp.value().replace(/[^a-z0-9]/gi, "")).filter(str => str !== "")

      idGame = rand_alphanumeric(6)

      fetch("/api/newGame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idSocket: socket.id,
          idGame: idGame,
          cpn: cleanPlayerNames
        })
      })
      .then(res => res.json())
      .then(data => {
        sgs = data
        yourIdx = 0
        syncPlayerSynths()
        display_game_state()
      })
      .catch(err => console.error("Error in newGame:", err))
    }

    function join_game(){
      fetch("/api/joinGame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idSocket: socket.id,
          idGame: idGame,
          playerIdx: Number(yourIdx)
        })
      })
      .then(res => res.json())
      .then(downData => {
        if (downData.msg && downData.msg.includes("could not be identified")) {
          alert(downData.msg)
        } else {
          socket.emit("room", downData.idGame)
          sgs = downData
          syncPlayerSynths()
          display_game_state()
        }
      })
      .catch(err => console.error("Error in joinGame:", err))
    }

    socket.on("dial-assert", function(incom){
      sgs = incom
      if (yourIdx === undefined) yourIdx = 0

      if (sgs.bpm) Tone.Transport.bpm.value = sgs.bpm
      if (sgs.swing !== undefined) {
        Tone.Transport.swingSubdivision = "16n"
        Tone.Transport.swing = sgs.swing
      }

      syncPlayerSynths()
      display_game_state()
    })

    /////////////////////
    // Form & Controls //
    /////////////////////
    function display_game_state(attemptToJoinGame = true){
      if (idGame === undefined) {
        const gParam = get_param("g")
        if (gParam !== null) idGame = gParam
      }
      if (yourIdx === undefined) {
        const pParam = get_param("p")
        if (pParam !== null) yourIdx = pParam
      }

      if (attemptToJoinGame && idGame !== undefined && yourIdx !== undefined && sgs === undefined){
        join_game()
        return
      }

      const sketchElem = document.getElementById("lovelySketch")
      if (!sketchElem) return
      const elemCoords = sketchElem.getBoundingClientRect()

      // STATE 1: Invitation / Start Screen
      if (sgs === undefined) {
        if (pNamIn.length === 0) {
          for (let i = 0; i < pMaxNos; i++){
            const defaultText = i === 0 ? "(Your name here)" : (i === 1 ? "(Collaborator 1)" : "")
            const inp = p.createInput(defaultText)
            inp.position(elemCoords.x + 40, window.scrollY + elemCoords.y + 90 + 35 * i)
            inp.size(160, 24)
            pNamIn.push(inp)
          }

          pNamIn.forEach((inp, idx) => {
            const btn = p.createButton(idx === 0 ? "Start!" : "Invite")
            const inpX = elemCoords.x + 40
            const inpW = 160
            btn.position(inpX + inpW + 15, window.scrollY + elemCoords.y + 90 + 35 * idx)
            btn.size(70, 28)
            if (idx === 0) {
              btn.mousePressed(new_game)
            } else {
              btn.attribute("disabled", "")
            }
            pNamBtn.push(btn)
          })
        }
      }
      // STATE 2: Waiting for collaborators
      else if (sgs && sgs.players && !sgs.players.every(pl => pl.joined)) {
        if (pNamIn.length > 0) {
          pNamIn.forEach(inp => inp.attribute("disabled", ""))
          pNamBtn.forEach((btn, idx) => {
            if (idx === 0) {
              btn.attribute("disabled", "")
            } else if (idx < sgs.players.length) {
              btn.removeAttribute("disabled")
              btn.mousePressed(() => {
                const inviteUrl = `${window.location.origin}${window.location.pathname}?g=${idGame}&p=${idx}`
                copy_to_clipboard(inviteUrl)
                alert(`Invite link for Player ${idx + 1} copied to clipboard!`)
              })
            }
          })
        }
      }
      // STATE 3: All joined
      else if (sgs && sgs.players && sgs.players.every(pl => pl.joined)) {
        pNamIn.forEach(inp => inp.hide())
        pNamBtn.forEach(btn => btn.hide())
        setup_sequencer_controls()
      }
    }

    function setup_sequencer_controls(){
      if (controlsCreated) return
      controlsCreated = true

      const sketchElem = document.getElementById("lovelySketch")
      if (!sketchElem) return
      const elemCoords = sketchElem.getBoundingClientRect()

      // Play / Stop button
      playBtn = p.createButton("Play / Stop")
      playBtn.position(elemCoords.x + 580, window.scrollY + elemCoords.y + 25)
      playBtn.size(100, 32)
      playBtn.mousePressed(toggle_play)

      // Host Controls (Player 0)
      if (Number(yourIdx) === 0) {
        bpmSlider = p.createSlider(60, 180, sgs.bpm || 100, 1)
        bpmSlider.position(elemCoords.x + 280, window.scrollY + elemCoords.y + 15)
        bpmSlider.size(110)

        swingSlider = p.createSlider(0, 0.99, sgs.swing || 0, 0.05)
        swingSlider.position(elemCoords.x + 280, window.scrollY + elemCoords.y + 55)
        swingSlider.size(110)

        updateTransportBtn = p.createButton("Update Tempo")
        updateTransportBtn.position(elemCoords.x + 420, window.scrollY + elemCoords.y + 25)
        updateTransportBtn.size(110, 32)
        updateTransportBtn.mousePressed(() => {
          fetch("/api/updateTransport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idSocket: socket.id,
              idGame: idGame,
              playerIdx: Number(yourIdx),
              bpm: bpmSlider.value(),
              swing: swingSlider.value()
            })
          })
          .then(res => res.json())
          .then(data => { 
            if (data) {
              sgs = data
              Tone.Transport.bpm.value = sgs.bpm
              Tone.Transport.swingSubdivision = "16n"
              Tone.Transport.swing = sgs.swing
            } 
          })
          .catch(err => console.error("Error updating transport:", err))
        })
      }
    }

    function toggle_play(){
      if (!contextStarted){
        Tone.start()
        contextStarted = true
      }
      if (Tone.Transport.state === "started"){
        Tone.Transport.stop()
        currentStep = 0
      } else {
        Tone.Transport.start()
      }
    }

    function get_param(name) {
      if (typeof mu !== "undefined" && mu.get_parameter_by_name) {
        return mu.get_parameter_by_name(name)
      }
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get(name)
    }

    function copy_to_clipboard(text) {
      if (typeof mu !== "undefined" && mu.copy_to_clipboard) {
        mu.copy_to_clipboard(text)
        return
      }
      navigator.clipboard.writeText(text)
    }

    function rand_alphanumeric(len){
      let outArr = new Array(len)
      for (let i = 0; i < len; i++){
        outArr[i] = 87 + Math.floor(36 * Math.random())
        if (outArr[i] < 97) outArr[i] -= 39
        outArr[i] = String.fromCharCode(outArr[i])
      }
      return outArr.join("")
    }
  }
}