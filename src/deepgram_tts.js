const { createClient } = require("@deepgram/sdk");
const fs = require("fs");
const { pipeline } = require("stream/promises");
require("dotenv").config();

const speak = async (text) => {
  const deepgramApiKey = process.env.DEEPGRAM;
  if (!deepgramApiKey) {
    throw new Error("Deepgram API key not found in environment variables.");
  }

  const outputFile = "output.wav"; // or change to a different extension if needed
  const deepgram = createClient(deepgramApiKey);

  try {
    const response = await deepgram.speak.request(
      { text },
      {
        model: 'aura-asteria-en',
        encoding: 'mulaw',
        container: 'wav'
      }
)    ;

    const stream = await response.getStream();
    if (stream) {
      const file = fs.createWriteStream(outputFile);
      await pipeline(stream, file);
      console.log(`Audio file written to ${outputFile}`);
      return outputFile;
    } else {
      throw new Error("Error generating audio: No stream returned");
    }
  } catch (err) {
    console.error("Error during TTS process:", err);
    throw err;
  }
}

module.exports = speak;
