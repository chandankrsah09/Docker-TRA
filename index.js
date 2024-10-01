const http = require("http");
const express = require("express");
const Docker = require("dockerode");
const httpProxy = require("http-proxy");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const proxy = httpProxy.createProxy({});

const db = new Map();

// Listen to Docker events
docker.getEvents(function (err, stream) {
  if (err) {
    console.log("Error in getting events", err);
    return;
  }

  stream.on("data", async (chunk) => {
    try {
      if (!chunk) return;
      const event = JSON.parse(chunk.toString());

      if (event.Type === "container" && event.Action === "start") {
        const container = docker.getContainer(event.id);
        const containerInfo = await container.inspect();

        const containerName = containerInfo.Name.substring(1); // Fixed typo from 'containerNmae' to 'containerName'
        const ipAddress = containerInfo.NetworkSettings.IPAddress;

        const exposedPorts = Object.keys(containerInfo.Config.ExposedPorts);
        let defaultPort = null;

        if (exposedPorts && exposedPorts.length > 0) {
          const [port, type] = exposedPorts[0].split("/");
          if (type === "tcp") {
            defaultPort = port;
          }
        }

        console.log(
          `Registering ${containerName}.localhost --> http://${ipAddress}:${defaultPort}`
        );

        db.set(containerName, { containerName, ipAddress, defaultPort });
      }
    } catch (err) {
      console.log("Error processing event:", err);
    }
  });
});

const reverseProxyApp = express();

// Reverse proxy logic for forwarding requests
reverseProxyApp.use(function (req, res) {
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];

  if (!db.has(subdomain)) {
    return res.status(404).send("404 Not Found"); // Proper 404 response
  }

  const { ipAddress, defaultPort } = db.get(subdomain);

  const target = `http://${ipAddress}:${defaultPort}`;

  console.log(`Forwarding ${hostname} -> ${target}`);

  return proxy.web(req, res, { target, changeOrigin: true, ws: true });
});

const reverseProxy = http.createServer(reverseProxyApp);

// WebSocket upgrade handler
reverseProxy.on("upgrade", (req, socket, head) => {
  const hostname = req.headers.host;
  const subdomain = hostname.split(":")[0];

  if (!db.has(subdomain)) {
    // Responding with a proper WebSocket 404 response
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    return socket.end();
  }

  const { ipAddress, defaultPort } = db.get(subdomain);

  const target = `http://${ipAddress}:${defaultPort}`;

  console.log(`Upgrading WebSocket for ${hostname} -> ${target}`);

  return proxy.ws(req, socket, head, {
    target,
    ws: true,
  });
});

const managementAPI = express();

managementAPI.use(express.json());

// API to create a new container from an image
managementAPI.post("/containers", async (req, res) => {
  const { image, tag = "latest" } = req.body; // Removed extra space from 'tag = "latest "'

  let imageExists = false;

  const images = await docker.listImages();

  for (const systemImage of images) {
    if (systemImage.RepoTags) {
      for (const systemTag of systemImage.RepoTags) {
        if (systemTag === `${image}:${tag}`) {
          imageExists = true;
          break;
        }
      }
    }
    if (imageExists) break;
  }

  if (!imageExists) {
    console.log(`Pulling Image: ${image}:${tag}`);
    await new Promise((resolve, reject) => {
      docker.pull(`${image}:${tag}`, (err, stream) => {
        if (err) {
          return reject(err);
        }
        docker.modem.followProgress(stream, (err, output) => {
          if (err) return reject(err);
          resolve(output);
        });
      });
    });
  }

  const container = await docker.createContainer({
    Image: `${image}:${tag}`,
    Tty: true,
    HostConfig: {
      AutoRemove: true,
    },
  });

  await container.start();

  const containerInfo = await container.inspect();

  return res.json({
    status: "success",
    container: `${containerInfo.Name.substring(1)}.localhost`,
  });
});

managementAPI.listen(8080, () => {
  console.log("Management API is running on PORT 8080");
});

reverseProxy.listen(80, () => {
  console.log("Reverse Proxy is running on PORT 80");
});
