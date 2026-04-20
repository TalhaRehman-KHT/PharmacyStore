import app from "../src/app.js";

// Vercel's Node runtime expects the Express app as the default export (not serverless-http, which targets AWS Lambda and can hang on Vercel).
export default app;
