# claude

Minimal Node.js app with Docker configuration.

## Running with Docker

```bash
docker compose up --build
```

The app will be available at http://localhost:3000.

## Running with Docker directly

```bash
docker build -t claude .
docker run -p 3000:3000 claude
```
