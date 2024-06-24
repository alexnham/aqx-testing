# Use an official CUDA runtime as a parent image
FROM nvidia/cuda:11.8.0-runtime-ubuntu20.04

# Set the working directory in the container
WORKDIR /usr/src/app

# Install Node.js and npm
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Copy package.json and package-lock.json first for caching
COPY /src/package*.json ./

# Install dependencies
RUN npm install

# Copy all other source files
COPY /src/. .

# Set environment variables
ENV DEEPGRAM=2346f4c8c5f359fe1b76992c556cf8003fbb50f6
ENV GROQ_API_KEY=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

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
CMD ["npm", "start"]
