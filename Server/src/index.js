import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 5050;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Pharmacy store API listening on http://127.0.0.1:${PORT} (port ${PORT})`);
    console.log(`  Health: http://127.0.0.1:${PORT}/api/health`);
  });
}

export default app;
