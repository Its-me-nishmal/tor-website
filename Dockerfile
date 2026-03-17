FROM node:18-slim

# Install Tor
RUN apt-get update && \
    apt-get install -y --no-install-recommends tor && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy app source
COPY . .

# Make startup script executable
RUN chmod +x scripts/start.sh

EXPOSE 3000

CMD ["scripts/start.sh"]
