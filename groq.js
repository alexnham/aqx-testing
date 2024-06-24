"use strict";
const Groq = require("groq-sdk");
require("dotenv").config();
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
async function runGroq(content) {
    const chatCompletion = await getGroqChatCompletion(content);
    // Print the completion returned by the LLM.
    return chatCompletion.choices[0]?.message?.content || ""
}
async function getGroqChatCompletion(content) {
    return groq.chat.completions.create({
        messages: content,
        model: "llama3-8b-8192"
    });
}
module.exports = {
    runGroq,
    getGroqChatCompletion
};

