# kaunasgame.dev

Landing page for Kaunas Game Dev community

## Prerequisites

Make sure you have [Hugo Extended](https://gohugo.io/getting-started/installing) installed and that your version is `0.87.0` or greater.

## Commands

Run a development server on `localhost:8080`:
```bash
hugo server --port 8080 --buildDrafts
```

Build a production ready site under `public` dir:
```bash
hugo --gc --minify --verbose
```
