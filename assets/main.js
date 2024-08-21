(function () {
  const Utils = {
    getRandomElement: function (list) {
      return list[Math.floor(Math.random() * list.length)]
    },

    getRandomRange: function (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min
    },
  }

  const Site = {
    initialize: function () {
      const paragraphElements = document.querySelectorAll('p, a, h1')

      paragraphElements.forEach(paragraphElement => {
        const classList = paragraphElement.classList

        const colorClass = Utils.getRandomElement([
          'text-color-01',
          'text-color-02',
          'text-color-03',
          'text-color-04',
          'text-color-05',
          'text-color-06',
        ])

        const shadowClass = Utils.getRandomElement([
          'text-shadow-01',
          'text-shadow-02',
          'text-shadow-03',
          'text-shadow-04',
          'text-shadow-05',
        ])

        const textClass = Utils.getRandomElement([
          'text-size-01',
          'text-size-02',
          'text-size-03',
          'text-size-04',
          'text-size-05',
        ])

        classList.add(colorClass)
        classList.add(shadowClass)
        classList.add(textClass)
      })
    },
  }

  window.addEventListener('DOMContentLoaded', function () {
    Site.initialize()
  })
})()
