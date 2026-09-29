const STEP_COUNT = 16

class GameState {
  constructor(){}

  /**
   * Creates a fresh "drum circle" game.
   *
   * Unlike the original social-synth (one shared synth, edited in turns),
   * here every player gets their own always-on 16-step lane and their own
   * randomized FM drum voice, all locked to one shared tempo/swing. So the
   * top-level state holds the *shared* transport settings, and each player
   * in `players` carries their *own* lane + voice.
   */
  make_game(){
    return {
      "bpm": 100,
      "swing": 0,
      // Only the player who starts the game (idx 0) is allowed to change
      // bpm/swing - see update_transport() below.
      "bpmOwnerIdx": 0,
      "players": [
        // {
        //   "name": "",
        //   "joined": false,
        //   "steps": [16 booleans],
        //   "voice": { ...randomized FM drum params }
        // }
      ]
    }
  }

  /**
   * Adds a player to a game, with an empty 16-step lane and a freshly
   * randomized FM drum voice. Voice params are generated here (server-side,
   * once) so that every client renders/sounds the same thing for this
   * player, rather than each browser rolling its own random numbers.
   */
  make_player(_game, _name, _joined){
    _game.players.push({
      "name": _name,
      "joined": _joined,
      "steps": new Array(STEP_COUNT).fill(false),
      "voice": this.random_drum_voice()
    })
  }

  /**
   * Toggles or sets a single step in a player's own lane. A player may only
   * edit their own lane (enforced by the caller passing matching indices),
   * so there's no turn order here - everyone can play at once.
   */
  update_steps(_game, _playerIdx, _steps){
    const player = _game.players[_playerIdx]
    if (player === undefined){
      return false
    }
    if (!Array.isArray(_steps) || _steps.length !== STEP_COUNT){
      return false
    }
    player.steps = _steps.map(Boolean)
    return true
  }

  /**
   * Updates the shared bpm/swing. Only the game's bpmOwnerIdx (the first
   * player, by default) is allowed to do this - mirrors "the first user
   * gets to determine the bpm and swing".
   */
  update_transport(_game, _playerIdx, _bpm, _swing){
    if (_playerIdx !== _game.bpmOwnerIdx){
      return false
    }
    if (typeof _bpm === "number" && _bpm > 0){
      _game.bpm = _bpm
    }
    if (typeof _swing === "number" && _swing >= 0 && _swing <= 1){
      _game.swing = _swing
    }
    return true
  }

  /**
   * Rolls a random-but-plausible percussive FM voice: a fast, punchy
   * envelope with randomized harmonicity/modulation for tonal variety,
   * plus a random base pitch so each player's drum sits somewhere
   * different in the mix. Tuned for Tone.FMSynth on the client.
   */
  random_drum_voice(){
    function rand(min, max){
      return min + Math.random()*(max - min)
    }
    function randInt(min, max){
      return Math.floor(rand(min, max + 1))
    }

    // Amplitude decay is rolled first so the pitch sweep can be kept
    // shorter than it - a sweep that outlasts the note would be inaudible.
    const ampDecay = Math.round(rand(0.05, 0.3)*1000)/1000

    return {
      // MIDI note number - kept in a low-ish register so it reads as "drum".
      "pitch": randInt(28, 55),
      // Pitch envelope: each hit starts `pitchAmount` semitones above
      // `pitch` and falls exponentially back to it over `pitchDecay`
      // seconds. That fast downward sweep is what gives a drum its "thump".
      // Range is ~0.6 to 2.5 octaves (subtle tom -> big kick); decay is
      // kept short (20 ms up to ~120 ms, never longer than the amp decay).
      "pitchAmount": randInt(7, 30),
      "pitchDecay": Math.round(rand(0.02, Math.min(0.12, ampDecay*0.9))*1000)/1000,
      "harmonicity": Math.round(rand(0.5, 8)*10)/10,
      "modulationIndex": randInt(2, 20),
      "oscillatorType": randChoice(["sine", "square", "triangle", "sawtooth"]),
      "modulationType": randChoice(["sine", "square", "triangle"]),
      "envelope": {
        "attack": 0.001,
        "decay": ampDecay,
        "sustain": 0,
        "release": Math.round(rand(0.05, 0.2)*1000)/1000
      },
      "modulationEnvelope": {
        "attack": 0.001,
        "decay": Math.round(rand(0.05, 0.2)*1000)/1000,
        "sustain": 0,
        "release": Math.round(rand(0.05, 0.2)*1000)/1000
      },
      // A hue for this player's UI colour, so their lane is visually theirs.
      "hue": randInt(0, 359)
    }
  }
}

function randChoice(arr){
  return arr[Math.floor(Math.random()*arr.length)]
}

module.exports = GameState