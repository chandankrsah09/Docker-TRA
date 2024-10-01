Docker Reverse Proxy Project
Overview
This project implements a Docker-based reverse proxy using Node.js, Express, and http-proxy. The reverse proxy serves as an intermediary for managing requests to multiple backend services, enabling seamless routing, load balancing, and enhanced security.

Features
Dynamic Service Registration: Automatically detects and registers Docker containers, allowing for real-time routing without manual configuration.
WebSocket Support: Handles WebSocket connections, ensuring a smooth experience for applications requiring real-time communication.
Management API: Provides a RESTful API to manage Docker containers easily, including starting new services by pulling images and creating containers.
Custom Domain Support: Routes requests based on subdomains, allowing different services to be accessed via custom URLs.
Getting Started
Prerequisites
Docker
Docker Compose
Installation
Clone the repository:

bash
Copy code
git clone https://github.com/chandankrsah09/docker-reverse-proxy.git
cd docker-reverse-proxy
Build and run the Docker containers:

bash
Copy code
docker-compose up
Access the management API at http://localhost:8080 and the reverse proxy at http://localhost.

Usage
Use the management API to register new Docker containers by sending a POST request to /containers with the image name and tag.
Access registered services using their corresponding subdomains (e.g., http://service-name.localhost).
Contributing
Contributions are welcome! Please submit a pull request or open an issue to discuss improvements.

License
This project is licensed under the MIT License. See the LICENSE file for details.

