FROM keymetrics/pm2:10-alpine

# Create app directory
COPY package*.json ./
COPY pm2.json ./

RUN npm install

COPY . .
RUN npm run build
EXPOSE 3000

CMD [ "pm2-runtime", "start", "pm2.json" ]