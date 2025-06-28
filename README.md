# Daily Task Academy

This project is a web application for managing daily tasks. It consists of a frontend, a backend, and an admin panel.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* [Docker](https://docs.docker.com/get-docker/)
* [Docker Compose](https://docs.docker.com/compose/install/)
* [direnv](https://direnv.net/)

### Installing

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd DailyTaskAcademy
   ```

2. Load the environment variables:

   ```bash
   direnv allow
   ```

3. Build and run the application:

   ```bash
   docker-compose up -d
   ```

## Accessing the application

* **Frontend:** [http://localhost:8080](http://localhost:8080)
* **Admin:** [http://localhost:8081](http://localhost:8081)
* **Backend:** [http://localhost:8082](http://localhost:8082)

## Stopping the application

To stop the application, run the following command:

```bash
docker-compose down
```
