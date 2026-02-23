import 'dotenv/config';
import app from './app.js';
import { pool } from './src/Config/db.js';

const PORT = process.env.PORT || 5000;



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});