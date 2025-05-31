require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoxLCJwaG9uZV9udW1iZXIiOiIrOTY0NzczMzAwMjA3NiIsImVtYWlsIjpudWxsLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNzQ4NzIyNDY5LCJleHAiOjE3NDg4MDg4Njl9.ICsVAqmd-oTuto2bcstWLzJzX3x9Yo2KlSC81rUhM0M";

console.log("TOKEN_KEY from env:", process.env.TOKEN_KEY);
console.log("Current timestamp:", Math.floor(Date.now() / 1000));

try {
    // Decode without verification first
    const decoded = jwt.decode(token);
    console.log("Decoded token (without verification):", JSON.stringify(decoded, null, 2));
    
    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
        console.log("❌ Token is EXPIRED");
    } else {
        console.log("✅ Token is not expired");
    }
    
    // Try to verify with the secret
    const verified = jwt.verify(token, process.env.TOKEN_KEY);
    console.log("✅ Token verification successful:", verified);
    
} catch (error) {
    console.error("❌ Token verification failed:", error.message);
    console.error("Error type:", error.name);
}