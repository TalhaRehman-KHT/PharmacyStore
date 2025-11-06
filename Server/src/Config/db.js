import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Test database connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Database connected successfully! With Supabase');
        client.release();
    } catch (error) {
        console.error('Error connecting to the database:', error.message);
        process.exit(1); // Exit process with failure
    }
};

testConnection();