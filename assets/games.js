(function () {
  const Constants = {

    // Drift speed, px per second
    speedRange: {
      min: 30.0,
      max: 80.0,
    },

    // Text shrink and how many float at once
    scale: 0.45,
    maxBubbles: 30,

    // Fewer, bigger on phones
    mobile: {
      maxWidth: 768,
      scale: 0.7,
      maxBubbles: 10,
    },

    // Extra diameter around the text
    padding: 40,

    // Matches the css scale-in
    spawnDurationMillis: 800,

    resizeDebounceMillis: 100,

    storageKey: 'games',
    muteStorageKey: 'games-muted',

    popLines: {
      count: 8,
      durationMillis: 50,
    },

    // "Games Popped: N" texts rising from a pop
    floaters: {
      countRange: {
        min: 1,
        max: 6,
      },
      durationRange: {
        min: 2000,
        max: 3000,
      },
      maxOffsetMillis: 400,
      sizeRange: {
        min: 0.8,
        max: 1.2,
      },

      // Sideways drift while rising, px either way
      maxDrift: 160,
    },

    // Rising bubbles on reroll and open
    risingBubbles: {
      countRange: {
        min: 30,
        max: 50,
      },
      mobileCountRange: {
        min: 10,
        max: 20,
      },
      sizeRange: {
        min: 36,
        max: 120,
      },
      durationRange: {
        min: 800,
        max: 1000,
      },
      maxDelayMillis: 160,
    },

    // Front-matter platform keys to popup text
    platformLabels: {
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux',
      android: 'Android',
      ios: 'iOS',
      web: 'Browser',
    },

    sounds: {
      pop: {
        src: '/sfx/sfx-pop.wav',
        playbackRateRange: {
          min: 0.8,
          max: 1.2,
        },
        volume: 1.5,

        // Optional, wet is the mix (0 dry .. 1 all reverb)
        reverb: {
          seconds: 0.8,
          decay: 4.0,
          wet: 0.35,
        },
      },

      // Reroll
      bubbles: {
        src: '/sfx/sfx-bubbles.mp3',
        playbackRateRange: {
          min: 0.8,
          max: 1.2,
        },
        volume: 2.0,
      },
    },
  }

  const Utils = {

    getRandomNumber: function (min, max) {
      return Math.random() * (max - min) + min
    },

    getRandomElement: function (list) {
      return list[Math.floor(Math.random() * list.length)]
    },

    shuffle: function (list) {
      return list.slice().sort(() => Math.random() - 0.5)
    },

    isMobile: function () {
      return window.innerWidth <= Constants.mobile.maxWidth
    },

    // Frame loop, delta in seconds
    animate: function (onUpdated) {
      let lastFrameTime = performance.now()

      function animationLoop(currentTime) {
        const deltaTime = (currentTime - lastFrameTime) / 1000.0
        lastFrameTime = currentTime

        onUpdated(deltaTime)

        requestAnimationFrame(animationLoop)
      }

      requestAnimationFrame(animationLoop)
    },
  }

  const Bubbles = {

    // All game anchors by user, hidden by default
    byUser: new Map(),

    // On screen right now
    bubbles: [],

    // Users dealt this round
    dealt: new Set(),

    // Popped so far, kept in localStorage
    used: new Set(),
    popCount: 0,

    initialize: function () {
      for (let element of document.querySelectorAll('a.bubble')) {
        const user = element.dataset.user

        if (!Bubbles.byUser.has(user)) {
          Bubbles.byUser.set(user, [])
        }

        Bubbles.byUser.get(user).push(element)
      }

      Bubbles.loadState()
      Bubbles.spawnSet(new Set(), true)

      document.querySelector('.reroll').addEventListener('click', function () {
        if (!Popup.isOpen()) {
          Bubbles.reroll(false)
        }
      })

      // Re-deal once resizing settles
      let resizeTimeout = null

      window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(function () {
          Bubbles.reroll(true)
        }, Constants.resizeDebounceMillis)
      })

      Utils.animate(Bubbles.step)
    },

    loadState: function () {
      const state = JSON.parse(localStorage.getItem(Constants.storageKey) || '{}')
      const popped = new Set(state.popped || [])

      for (let elements of Bubbles.byUser.values()) {
        for (let element of elements) {
          if (popped.has(element.href)) {
            Bubbles.used.add(element)
          }
        }
      }

      Bubbles.popCount = state.popCount || 0
    },

    saveState: function () {
      const state = {
        popped: Array.from(Bubbles.used).map(element => element.href),
        popCount: Bubbles.popCount,
      }

      localStorage.setItem(Constants.storageKey, JSON.stringify(state))
    },

    // Random subset of users, one game each
    spawnSet: function (avoid, isQuiet) {
      const maxBubbles = Utils.isMobile() ? Constants.mobile.maxBubbles : Constants.maxBubbles
      const users = Utils.shuffle(Array.from(Bubbles.byUser.keys())).slice(0, maxBubbles)

      Bubbles.dealt = new Set(users)

      for (let user of users) {
        Bubbles.spawn(Bubbles.pickGame(user, avoid))
      }

      if (!isQuiet) {
        Vfx.playSound('bubbles')
        Vfx.spawnRisingBubbles()
      }
    },

    // Die click, old set is not counted as popped
    reroll: function (isQuiet) {
      const previous = new Set(Bubbles.bubbles.map(bubble => bubble.element))

      for (let bubble of Bubbles.bubbles) {
        bubble.element.hidden = true
      }

      Bubbles.bubbles = []
      Bubbles.spawnSet(previous, isQuiet)
    },

    // Undealt user, or a new set once the screen is empty
    spawnNext: function () {
      const users = Array.from(Bubbles.byUser.keys()).filter(user => !Bubbles.dealt.has(user))

      if (users.length > 0) {
        const user = Utils.getRandomElement(users)

        Bubbles.dealt.add(user)
        Bubbles.spawn(Bubbles.pickGame(user, new Set()))
      } else if (Bubbles.bubbles.length === 0) {
        Bubbles.spawnSet(new Set(), false)
      }
    },

    // Fresh > unseen > any, used resets once all popped
    pickGame: function (user, avoid) {
      const games = Bubbles.byUser.get(user)
      const unseen = games.filter(game => !Bubbles.used.has(game))
      const fresh = unseen.filter(game => !avoid.has(game))

      if (unseen.length === 0) {
        for (let game of games) {
          Bubbles.used.delete(game)
        }
      }

      const candidates = fresh.length > 0 ? fresh : (unseen.length > 0 ? unseen : games)

      return Utils.getRandomElement(candidates)
    },

    spawn: function (element) {
      element.hidden = false

      // Clear old size before measuring
      element.style.width = ''
      element.style.height = ''
      element.style.fontSize = ''

      const scale = Utils.isMobile() ? Constants.mobile.scale : Constants.scale
      const fontSize = parseFloat(getComputedStyle(element).fontSize) * scale

      element.style.fontSize = `${fontSize}px`

      // Text box diagonal, wrapped lines fit
      const textDiagonal = Math.hypot(element.offsetWidth, element.offsetHeight)
      const diameter = textDiagonal + Constants.padding * scale

      element.style.width = `${diameter}px`
      element.style.height = `${diameter}px`

      const radius = diameter / 2
      const speed = Utils.getRandomNumber(Constants.speedRange.min, Constants.speedRange.max)
      const angle = Utils.getRandomNumber(0, Math.PI * 2)

      const bubble = {
        element: element,
        radius: radius,
        spawnedAt: performance.now(),
        position: {
          x: Utils.getRandomNumber(radius, window.innerWidth - radius),
          y: Utils.getRandomNumber(radius, window.innerHeight - radius),
        },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
      }

      element.onclick = function (clickEvent) {
        clickEvent.preventDefault()

        if (!Popup.isOpen()) {
          Bubbles.pop(bubble)
          Popup.show(element)
        }
      }

      // Right click pops without the popup
      element.oncontextmenu = function (clickEvent) {
        clickEvent.preventDefault()

        if (!Popup.isOpen()) {
          Bubbles.pop(bubble)
          Bubbles.spawnNext()
        }
      }

      Bubbles.render(bubble)
      Bubbles.bubbles.push(bubble)
    },

    step: function (deltaTime) {
      const bubbles = Bubbles.bubbles

      for (let bubble of bubbles) {
        Bubbles.move(bubble, deltaTime)
      }

      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          Bubbles.collide(bubbles[i], bubbles[j])
        }
      }

      for (let bubble of bubbles) {
        Bubbles.render(bubble)
      }
    },

    // Position is the center
    move: function (bubble, deltaTime) {
      const {radius, position, velocity} = bubble

      const maxX = window.innerWidth - radius
      const maxY = window.innerHeight - radius

      position.x += velocity.x * deltaTime
      position.y += velocity.y * deltaTime

      // Flip only when heading out, resize jitters otherwise
      if ((position.x <= radius && velocity.x < 0) || (position.x >= maxX && velocity.x > 0)) {
        velocity.x *= -1
      }

      if ((position.y <= radius && velocity.y < 0) || (position.y >= maxY && velocity.y > 0)) {
        velocity.y *= -1
      }

      position.x = Math.max(radius, Math.min(position.x, maxX))
      position.y = Math.max(radius, Math.min(position.y, maxY))
    },

    // Follows the css scale-in
    currentRadius: function (bubble) {
      const progress = (performance.now() - bubble.spawnedAt) / Constants.spawnDurationMillis

      return bubble.radius * Math.min(1, progress)
    },

    // Equal mass bounce and separation
    collide: function (bubbleA, bubbleB) {
      const deltaX = bubbleB.position.x - bubbleA.position.x
      const deltaY = bubbleB.position.y - bubbleA.position.y
      const distance = Math.hypot(deltaX, deltaY)
      const minDistance = Bubbles.currentRadius(bubbleA) + Bubbles.currentRadius(bubbleB)

      if (distance >= minDistance || distance === 0) {
        return
      }

      const normalX = deltaX / distance
      const normalY = deltaY / distance

      const overlap = (minDistance - distance) / 2

      bubbleA.position.x -= normalX * overlap
      bubbleA.position.y -= normalY * overlap
      bubbleB.position.x += normalX * overlap
      bubbleB.position.y += normalY * overlap

      const relativeX = bubbleB.velocity.x - bubbleA.velocity.x
      const relativeY = bubbleB.velocity.y - bubbleA.velocity.y
      const approach = relativeX * normalX + relativeY * normalY

      // Already separating
      if (approach > 0) {
        return
      }

      bubbleA.velocity.x += normalX * approach
      bubbleA.velocity.y += normalY * approach
      bubbleB.velocity.x -= normalX * approach
      bubbleB.velocity.y -= normalY * approach
    },

    render: function (bubble) {
      const {element, radius, position} = bubble

      element.style.left = `${position.x - radius}px`
      element.style.top = `${position.y - radius}px`
    },

    pop: function (bubble) {
      const {element} = bubble

      Bubbles.popCount++

      Vfx.playSound('pop')
      Vfx.spawnPopLines(bubble)
      Vfx.spawnFloaters(bubble, `Games Popped: ${Bubbles.popCount}`)

      // Back to the pool
      element.hidden = true
      Bubbles.used.add(element)
      Bubbles.bubbles = Bubbles.bubbles.filter(other => other !== bubble)

      Bubbles.saveState()
    },
  }

  const Vfx = {

    audioContext: null,

    // Decoded sound buffers by name
    buffers: {},

    // Impulse responses by sound name, reverb sounds only
    impulses: {},

    // AudioContext needs a gesture
    loadSounds: function () {
      Vfx.audioContext = new AudioContext()

      const loads = []

      for (let [name, sound] of Object.entries(Constants.sounds)) {
        const load = fetch(sound.src)
          .then(response => response.arrayBuffer())
          .then(data => Vfx.audioContext.decodeAudioData(data))
          .then(buffer => Vfx.buffers[name] = buffer)

        loads.push(load)

        if (sound.reverb) {
          Vfx.impulses[name] = Vfx.createImpulse(sound.reverb)
        }
      }

      return Promise.all(loads)
    },

    // Decaying noise
    createImpulse: function (reverb) {
      const audioContext = Vfx.audioContext
      const length = Math.round(audioContext.sampleRate * reverb.seconds)
      const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate)

      for (let channel = 0; channel < 2; channel++) {
        const samples = impulse.getChannelData(channel)

        for (let index = 0; index < length; index++) {
          const envelope = Math.pow(1 - index / length, reverb.decay)
          samples[index] = (Math.random() * 2 - 1) * envelope
        }
      }

      return impulse
    },

    // No-op until loaded
    playSound: function (name) {
      const buffer = Vfx.buffers[name]

      if (buffer === undefined) {
        return
      }

      const {playbackRateRange, volume, reverb} = Constants.sounds[name]

      const audioContext = Vfx.audioContext
      const now = audioContext.currentTime

      const playbackRate = Utils.getRandomNumber(playbackRateRange.min, playbackRateRange.max)

      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = playbackRate

      // Fade-in, wav starts mid-transient
      const gain = audioContext.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + 0.005)

      source.connect(gain)
      gain.connect(audioContext.destination)

      // Wet path parallel to dry
      if (reverb) {
        const convolver = audioContext.createConvolver()
        convolver.buffer = Vfx.impulses[name]

        const wetGain = audioContext.createGain()
        wetGain.gain.value = reverb.wet

        gain.connect(convolver)
        convolver.connect(wetGain)
        wetGain.connect(audioContext.destination)
      }

      source.start(now)
    },

    // Animated in css
    spawnPopLines: function (bubble) {
      const {position, radius} = bubble
      const {count, durationMillis} = Constants.popLines

      const linesElement = document.createElement('div')
      linesElement.className = 'pop-lines'
      linesElement.style.left = `${position.x}px`
      linesElement.style.top = `${position.y}px`
      linesElement.style.setProperty('--radius', `${radius}px`)
      linesElement.style.setProperty('--duration', `${durationMillis}ms`)

      for (let index = 0; index < count; index++) {
        const lineElement = document.createElement('span')
        const angle = (360 / count) * index + Utils.getRandomNumber(-10, 10)

        lineElement.style.setProperty('--angle', `${angle}deg`)
        linesElement.appendChild(lineElement)
      }

      document.body.appendChild(linesElement)

      setTimeout(function () {
        linesElement.remove()
      }, durationMillis)
    },

    // Animated in css
    spawnRisingBubbles: function () {
      const {sizeRange, durationRange, maxDelayMillis} = Constants.risingBubbles

      const skinSrc = document.querySelector('.bubble-skin').src
      const countRange = Utils.isMobile() ? Constants.risingBubbles.mobileCountRange : Constants.risingBubbles.countRange
      const count = Math.round(Utils.getRandomNumber(countRange.min, countRange.max))

      for (let index = 0; index < count; index++) {
        const bubbleElement = document.createElement('div')
        const size = Utils.getRandomNumber(sizeRange.min, sizeRange.max)
        const durationMillis = Utils.getRandomNumber(durationRange.min, durationRange.max)
        const delayMillis = Utils.getRandomNumber(0, maxDelayMillis)

        // Rise and wobble are both transform, two elements
        bubbleElement.className = 'rising-bubble'
        bubbleElement.innerHTML = `<img src="${skinSrc}" alt="">`
        bubbleElement.style.left = `${Utils.getRandomNumber(0, window.innerWidth - size)}px`
        bubbleElement.style.width = `${size}px`
        bubbleElement.style.setProperty('--duration', `${durationMillis}ms`)
        bubbleElement.style.setProperty('--delay', `${delayMillis}ms`)
        bubbleElement.style.setProperty('--wobble-offset', `${-Utils.getRandomNumber(0, 1000)}ms`)

        // Staggered start below the edge
        const start = Utils.getRandomNumber(0, window.innerHeight * 0.3)

        bubbleElement.style.setProperty('--start', `${start}px`)

        document.body.appendChild(bubbleElement)

        setTimeout(function () {
          bubbleElement.remove()
        }, durationMillis + delayMillis)
      }
    },

    // Animated in css
    spawnFloaters: function (bubble, text) {
      const {position, radius} = bubble
      const {countRange, durationRange, maxOffsetMillis, sizeRange, maxDrift} = Constants.floaters

      const count = Math.round(Utils.getRandomNumber(countRange.min, countRange.max))

      for (let index = 0; index < count; index++) {
        const floaterElement = document.createElement('div')
        const durationMillis = Utils.getRandomNumber(durationRange.min, durationRange.max)

        floaterElement.className = 'floater'
        floaterElement.innerHTML = `<span>${text}</span>`
        floaterElement.style.left = `${position.x + Utils.getRandomNumber(-radius, radius)}px`
        floaterElement.style.top = `${position.y + Utils.getRandomNumber(-radius, radius)}px`
        floaterElement.style.setProperty('--duration', `${durationMillis}ms`)
        const drift = Utils.getRandomNumber(-maxDrift, maxDrift)

        floaterElement.style.setProperty('--drift', `${drift}px`)
        floaterElement.style.fontSize = `${Utils.getRandomNumber(sizeRange.min, sizeRange.max)}em`

        // Negative delay, random phase
        const riseOffset = -Utils.getRandomNumber(0, maxOffsetMillis)

        floaterElement.style.setProperty('--rise-offset', `${riseOffset}ms`)
        floaterElement.style.setProperty('--wobble-offset', `${-Utils.getRandomNumber(0, 1000)}ms`)

        document.body.appendChild(floaterElement)

        setTimeout(function () {
          floaterElement.remove()
        }, durationMillis)
      }
    },
  }

  // Blocks pops while open
  const Popup = {

    element: null,

    initialize: function () {
      Popup.element = document.querySelector('.popup')

      // X, Cancel and Open all close
      for (let closeElement of Popup.element.querySelectorAll('.popup-close, .popup-open')) {
        closeElement.addEventListener('click', function () {
          Popup.close()
          Bubbles.spawnNext()
        })
      }

      Popup.element.querySelector('.popup-open').addEventListener('click', function () {
        Vfx.spawnRisingBubbles()
      })

      // Hide after the close animation
      Popup.element.addEventListener('animationend', function (animationEvent) {
        if (animationEvent.animationName === 'popup-close') {
          Popup.element.classList.remove('closing')
          Popup.element.hidden = true
        }
      })
    },

    close: function () {
      Popup.element.classList.add('closing')
      document.querySelector('.popup-backdrop').classList.remove('visible')
    },

    isOpen: function () {
      return !Popup.element.hidden
    },

    show: function (bubbleElement) {
      const popupElement = Popup.element
      const title = bubbleElement.querySelector('.bubble-title').textContent
      const author = bubbleElement.querySelector('.bubble-author').textContent

      // Empty when unknown
      const platforms = bubbleElement.dataset.platforms
        .split(',')
        .filter(platform => platform !== '')
        .map(platform => Constants.platformLabels[platform])
        .join(', ')

      const titleElement = popupElement.querySelector('.popup-title')
      const thumbnailElement = popupElement.querySelector('.popup-thumbnail')
      const thumbnail = bubbleElement.dataset.thumbnail

      titleElement.textContent = title
      titleElement.style.color = getComputedStyle(bubbleElement).color

      // Blank until loaded, css fades in
      thumbnailElement.hidden = thumbnail === ''
      thumbnailElement.width = bubbleElement.dataset.thumbnailWidth
      thumbnailElement.height = bubbleElement.dataset.thumbnailHeight
      thumbnailElement.classList.remove('loaded')
      thumbnailElement.onload = function () {
        thumbnailElement.classList.add('loaded')
      }
      thumbnailElement.src = ''
      thumbnailElement.src = thumbnail
      popupElement.querySelector('.popup-author').textContent = author
      const platformsText = platforms ? `Platforms: ${platforms}` : ''

      popupElement.querySelector('.popup-platforms').textContent = platformsText
      popupElement.querySelector('.popup-open').href = bubbleElement.href

      popupElement.hidden = false
      document.querySelector('.popup-backdrop').classList.add('visible')
    },
  }

  // Music only, sfx stay on
  const Mute = {

    initialize: function () {
      const muteElement = document.querySelector('.mute')
      const backgroundAudio = document.getElementById('background-audio')

      const srcUnmuted = muteElement.src
      const srcMuted = muteElement.dataset.srcMuted

      function apply(isMuted) {
        backgroundAudio.muted = isMuted
        muteElement.src = isMuted ? srcMuted : srcUnmuted
        localStorage.setItem(Constants.muteStorageKey, isMuted ? 'true' : 'false')
      }

      apply(localStorage.getItem(Constants.muteStorageKey) === 'true')

      muteElement.addEventListener('click', function () {
        apply(!backgroundAudio.muted)
      })
    },
  }

  window.addEventListener('DOMContentLoaded', function () {
    Popup.initialize()
    Bubbles.initialize()
    Mute.initialize()

    // Audio needs a gesture
    window.addEventListener('pointerdown', function () {
      document.getElementById('background-audio').play()
      Vfx.loadSounds()
    }, {once: true})
  })
})()
