# Deploying Pipi Volleyball

This project builds to a static website. The generated files can be uploaded to a company web domain, CDN, object storage bucket, or any static hosting service.

## Build And Package

Run these commands in VS Code Terminal:

```powershell
cd F:\AI\Codex\pipi_volleyball
npm install
npm run package
```

The packaged zip will be created at:

```text
F:\AI\Codex\pipi_volleyball\releases\pipi-volleyball-web.zip
```

## Upload

Unzip `pipi-volleyball-web.zip` and upload all files inside it to the company web host.

The zip contents should include files like:

```text
index.html
assets/
```

Upload the contents of the zip, not the zip file itself, unless your hosting platform has its own zip upload/import feature.

## Test After Upload

- Open the company URL in Chrome or Edge.
- Confirm the game loads without a blank page.
- Press `開始`, then `Enter` to drop the ball.
- Test `A/D`, `W`, `J`, and `Space`.
- Confirm custom images and audio load correctly.

## Notes

The Vite base path is set to `./`, so the build can work from either a root domain or a subfolder.

## Docker Deployment

The project includes a Docker setup for platforms that expect a running container.

The container:

- builds the Vite project with Node
- serves `dist` with nginx
- listens on port `9467`

Use these files:

```text
Dockerfile
deploy/nginx.conf
```

If the company platform asks for a container port, use:

```text
9467
```

If the platform has a "container port mapping" or "API proxy" setting, point the public domain to port `9467`.
