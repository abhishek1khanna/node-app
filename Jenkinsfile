pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'node-app-image'
    }

    stages {
        stage('Clone repository') {
            steps {
                // Checkout the code from your repository
                git branch: 'main', url: 'https://github.com/abhishek1khanna/node-app.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Build Docker image from Dockerfile (use bat instead of sh for Windows)
                    bat 'docker build -t ${DOCKER_IMAGE} .'
                }
            }
        }

        stage('Run Docker Compose') {
            steps {
                script {
                    // Run Docker Compose to set up services (use bat)
                    bat 'docker-compose up -d'
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    // Run tests within the Docker container (use bat)
                    bat 'docker exec $(docker ps -qf "name=node-app-dev") npm test'
                }
            }
        }

        stage('Clean up') {
            steps {
                script {
                    // Stop and remove containers (use bat)
                    bat 'docker-compose down'
                }
            }
        }
    }

    post {
        always {
            script {
                // Clean up Docker images (use bat)
                bat 'docker system prune -f'
            }
        }
    }
}
