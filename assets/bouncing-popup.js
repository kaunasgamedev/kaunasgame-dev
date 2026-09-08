(function () {
  const Constants = {

    // Px per second
    speed: 120.0,

    colorClasses: [
      'text-color-01',
      'text-color-02',
      'text-color-03',
      'text-color-04',
      'text-color-05',
      'text-color-06',
      'text-color-07',
      'text-color-08',
    ],
  }

  const Utils = {

    getRandomElement: function (list) {
      return list[Math.floor(Math.random() * list.length)]
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

  // DVD logo style, new color on each bounce
  const BouncingPopup = {

    initialize: function () {
      for (let element of document.querySelectorAll('a.bouncing-popup')) {
        const popup = {
          element: element,
          position: {
            x: (window.innerWidth - element.offsetWidth) / 2,
            y: (window.innerHeight - element.offsetHeight) / 2,
          },
          velocity: {
            x: (Math.random() < 0.5 ? 1 : -1) * Constants.speed,
            y: (Math.random() < 0.5 ? 1 : -1) * Constants.speed,
          },
        }

        // The X is decoration, don't follow the link
        element.querySelector('.title-bar-close').addEventListener('click', function (clickEvent) {
          clickEvent.preventDefault()
          clickEvent.stopPropagation()
        })

        BouncingPopup.changeColor(popup)

        Utils.animate(function (deltaTime) {
          BouncingPopup.move(popup, deltaTime)
        })
      }
    },

    move: function (popup, deltaTime) {
      const {element, position, velocity} = popup

      const maxX = window.innerWidth - element.offsetWidth
      const maxY = window.innerHeight - element.offsetHeight

      let isBounced = false

      position.x += velocity.x * deltaTime
      position.y += velocity.y * deltaTime

      if (position.x <= 0 || position.x >= maxX) {
        position.x = Math.max(0, Math.min(position.x, maxX))
        velocity.x *= -1
        isBounced = true
      }

      if (position.y <= 0 || position.y >= maxY) {
        position.y = Math.max(0, Math.min(position.y, maxY))
        velocity.y *= -1
        isBounced = true
      }

      if (isBounced) {
        BouncingPopup.changeColor(popup)
      }

      element.style.left = `${position.x}px`
      element.style.top = `${position.y}px`
    },

    // Swap to a different random color class
    changeColor: function (popup) {
      const {element} = popup

      const colorClasses = Constants.colorClasses
      const current = colorClasses.find(colorClass => element.classList.contains(colorClass))
      const available = colorClasses.filter(colorClass => colorClass !== current)

      element.classList.remove(current)
      element.classList.add(Utils.getRandomElement(available))
    },
  }

  window.addEventListener('DOMContentLoaded', function () {
    BouncingPopup.initialize()
  })
})()
