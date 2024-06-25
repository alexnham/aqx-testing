// Import required modules
const speak = require('./deepgram_tts.js'); // Module for TTS (Text-to-Speech)
const WebSocket = require('ws'); // Module for WebSocket communication
const express = require('express'); // Express framework for HTTP server
const app = express(); // Create an Express application
const http = require('http'); // HTTP server module
const server = http.createServer(app); // Create an HTTP server
const wss = new WebSocket.Server({ server }); // Create a WebSocket server
const { VoiceResponse } = require('twilio').twiml; // Twilio Voice Response for TwiML
const twilioResponse = new VoiceResponse(); // Create a new Twilio Voice Response
const fs = require('fs'); // File system module
const { runGroq } = require('./groq.js') // Module for running LLM (Language Model) queries
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const dotenv = require("dotenv");
dotenv.config();


// Define the request configurations for Deepgram

// Function to convert text to mulaw/8000 encoded audio and then to base64
const stringToMulaw8000ToBase64 = async (text) => {
  console.time('totalConversion'); // Start timer for total conversion
  const audioFilePath = await synthesizeText(text); // Synthesize text to audio
  const base64EncodedAudio = await encodeToBase64(audioFilePath); // Encode audio to base64
  console.timeEnd('totalConversion'); // End timer for total conversion
  return base64EncodedAudio;
}

// Function to synthesize text into audio
const synthesizeText = async (text) => {
  try {
    console.time('deepgram'); // Start timer for Deepgram TTS
    const outputFile = await speak(text); // Generate audio file using TTS
    console.timeEnd('deepgram'); // End timer for Deepgram TTS
    // Convert the audio file to mulaw/8000 format using sox
    return 'output.wav'; // Return the converted file path
  } catch (error) {
    console.error('Error during audio synthesis or conversion:', error);
    throw error; // Throw error if any
  }
}

// Function to encode the inputted mulaw-8000 file to base64
const encodeToBase64 = (filePath) => {
  return new Promise((resolve, reject) => {
    console.time('stringConversion'); // Start timer for string conversion
    fs.readFile(filePath, (err, data) => { // Read the file
      if (err) {
        reject(err); // Reject promise if error
      } else {
        const base64Encoded = Buffer.from(data, 'binary').toString('base64');
        console.timeEnd('stringConversion'); // End timer for string conversion
        resolve(base64Encoded); // Resolve promise with base64 string
      }
    });
  });
}

// Creating the WebSocket server
wss.on('connection', (ws) => {
  let streamSid = null;
  let conversation = [];
  let dgResponse = null
  connectionOpen = false; // Flag to check if connection is open

  // Listening for message and running action based on message
  const deepgramClient = createClient(process.env.DEEPGRAM);
  const dgConnection = deepgramClient.listen.live({
    model: "nova-2",
    smart_format: true,
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    endpointing:300

  });

  dgConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log('Deepgram connection opened.');
    connectionOpen = true;

    dgConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      if(data.speech_final) {
        dgResponse = data.channel.alternatives[0].transcript
      }

    });
  })

  ws.on('message', async (message) => {
    const msg = JSON.parse(message); // Parse the message

    // Switch case for the event of the message
    switch (msg.event) {
      case 'start':
        console.log('Listening in on Call');
        streamSid = msg.start.streamSid; // Save the stream SID
        conversation.push(
          {
            role: "system",
            content: 
            `
            You are Katy, the AI customer service agent for GreenSmile Dental Clinic, a dental practice dedicated to providing top-notch dental care with an emphasis on sustainability and patient comfort. Your primary goal is to provide excellent customer service by addressing inquiries, scheduling appointments, resolving issues, and offering detailed information about our services and eco-friendly practices. You should maintain a friendly, professional, and helpful tone at all times. Here are your key responsibilities:

            Greeting Customers:
    
            Start every interaction with a warm and courteous greeting.
            Example: "Hello! Thank you for contacting GreenSmile Dental Clinic. How can I assist you today?"
            Appointment Scheduling:
    
            Assist patients in scheduling, rescheduling, or canceling appointments.
            Example: "I can help you schedule an appointment. Can you please provide me with your preferred date and time?"
            Service Information:
    
            Provide detailed information about our dental services, including routine check-ups, cosmetic procedures, orthodontics, and emergency care.
            Example: "We offer a variety of dental services, including teeth whitening, braces, and emergency dental care. Which service are you interested in?"
            Billing and Insurance:
    
            Answer questions related to billing, insurance claims, and payment options.
            Example: "We accept a range of insurance plans. Can you please provide me with your insurance details so I can check your coverage?"
            Sustainability Practices:
    
            Inform patients about our eco-friendly practices and materials used in the clinic.
            Example: "At GreenSmile, we use biodegradable dental supplies and energy-efficient equipment to reduce our environmental impact."
            Handling Complaints:
    
            Address patient complaints with empathy and provide solutions or escalate to a human representative if necessary.
            Example: "I'm sorry to hear about your experience. Let me assist you in resolving this matter promptly."
            Reminders and Follow-ups:
    
            Send appointment reminders and follow-up messages to ensure patients keep their appointments and receive post-treatment care instructions.
            Example: "This is a reminder for your dental appointment scheduled for tomorrow at 10 AM. We look forward to seeing you!"
            Operating Hours:
    
            Inform patients of our operating hours and when they can expect responses from human representatives.
            Example: "Our clinic is open Monday through Friday, from 8 AM to 5 PM EST. If you need assistance outside of these hours, I'll do my best to help you, and a human representative will follow up during our operating hours."
            Emergency Assistance:
    
            Provide information on how to handle dental emergencies and connect patients with on-call dental staff if needed.
            Example: "If you are experiencing a dental emergency, please call our emergency line at [phone number] or visit our clinic immediately."
            Closing Interactions:
    
            End conversations on a positive note, ensuring the patient feels valued and appreciated.
            Example: "Thank you for choosing GreenSmile Dental Clinic. If you have any other questions, feel free to reach out. Have a great day!"
            Remember to always prioritize the patient's needs, provide clear and concise information, and uphold the values of GreenSmile Dental Clinic in promoting sustainability and high-quality dental care.
            `
          }
        );
        break;
      case 'connected':
        console.log('connected');
        break;
      // Inside the 'media' case block
      case 'media':
        if (connectionOpen && dgConnection) {
          const audio = Buffer.from(msg.media.payload, 'base64');
          const test = dgConnection.send(audio);
        } else {
          console.log('Connection not open or dgConnection not initialized');
        }
        if (dgResponse) {
          console.log('*******************');
          console.log(dgResponse);
          console.log('*******************');
          console.time('totalResponse'); // Start timer for total response

          console.time('LLMResponse'); // Start timer for LLM response
          conversation.push({ // Add user input to conversation
            role: "user",
            content: "Please provide a concise response: " + dgResponse
          });
          dgResponse = null
          const llmResponse = await runGroq(conversation); // Get LLM response
          console.timeEnd('LLMResponse'); // End timer for LLM response

          const payload = await stringToMulaw8000ToBase64(llmResponse); // Convert LLM response to audio

          console.timeEnd('totalResponse'); // End timer for total response
          conversation.push({ // Add LLM response to conversation
            role: "assistant",
            content: llmResponse
          });


          // Send the modified response back to the WebSocket
          ws.send(JSON.stringify({
            streamSid,
            event: 'media',
            media: {
              payload: payload
            }
          }));
        }
        // Send the raw audio data to Deepgram
        break;

      case 'stop':
        console.log('Call Ended');
        if (dgConnection) {
          dgConnection.finish();
        }
        break;
    }
  });
})

  // HTTP POST request every time a phone call is dialed in
  app.post('/', (req, res) => {
    twilioResponse.play('https://salmon-angelfish-2299.twil.io/assets/welcome.mp3'); // Play a welcome message
    const start = twilioResponse.connect(); // Create a new <Connect> verb
    const url = `http://${req.headers.host}`
    start.stream({
      url: `wss://${req.headers.host}`, // Set the WebSocket URL
    });

    // Send the TwiML response
    res.set('Content-Type', 'text/xml'); // Set the content type header
    res.status(200).send(twilioResponse.toString()); // Send the TwiML response as a string
  });

  // Listen on port 8000
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });