# Stage 1: Build & Base Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Expose web app port
EXPOSE 3000

# Set Environment to Production
ENV NODE_ENV=production

# Command to start the application
CMD ["npm", "start"]
