FROM node:20
WORKDIR /app
RUN apt-get update && apt-get install -y git
RUN git clone https://github.com/abhishek1khanna/node-app.git .
RUN npm install
ENV PORT 3000
EXPOSE $PORT
CMD [ "npm","run","prod" ]