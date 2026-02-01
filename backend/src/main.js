/**
 * WMS Backend Function - Main Entry Point
 * This function handles server-side operations for the Warehouse Management System
 */

import { Client, Databases, ID, Query } from 'node-appwrite';

// Initialize Appwrite Client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

// CORS Headers helper
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Main function handler for Appwrite Functions
 */
export default async ({ req, res, log, error }) => {
    const { method, path, body } = req;

    log(`Request: ${method} ${path}`);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return res.empty(204, corsHeaders);
    }

    // Helper function to send JSON with CORS
    const jsonResponse = (data, status = 200) => {
        return res.json(data, status, corsHeaders);
    };

    try {
        // Route handling
        if (path === '/products' && method === 'GET') {
            // Get all products
            const products = await databases.listDocuments(DATABASE_ID, 'products');
            return jsonResponse(products);
        }

        if (path === '/products' && method === 'POST') {
            // Create new product
            const data = JSON.parse(body);
            const product = await databases.createDocument(
                DATABASE_ID,
                'products',
                ID.unique(),
                data
            );
            return jsonResponse(product);
        }

        if (path === '/movements' && method === 'GET') {
            // Get all movements
            const movements = await databases.listDocuments(DATABASE_ID, 'movements');
            return jsonResponse(movements);
        }

        if (path === '/movements/inbound' && method === 'POST') {
            // Create inbound movement and update stock
            const data = JSON.parse(body);
            
            // Create movement record
            const movement = await databases.createDocument(
                DATABASE_ID,
                'movements',
                ID.unique(),
                {
                    ...data,
                    type: 'inbound',
                    createdAt: new Date().toISOString()
                }
            );

            // Update product quantity
            const product = await databases.getDocument(DATABASE_ID, 'products', data.productId);
            await databases.updateDocument(DATABASE_ID, 'products', data.productId, {
                quantity: (product.quantity || 0) + data.quantity
            });

            return jsonResponse({ success: true, movement });
        }

        if (path === '/movements/outbound' && method === 'POST') {
            // Create outbound movement and reduce stock
            const data = JSON.parse(body);
            
            // Check stock availability
            const product = await databases.getDocument(DATABASE_ID, 'products', data.productId);
            if (product.quantity < data.quantity) {
                return jsonResponse({ success: false, error: 'الكمية غير متوفرة' }, 400);
            }

            // Create movement record
            const movement = await databases.createDocument(
                DATABASE_ID,
                'movements',
                ID.unique(),
                {
                    ...data,
                    type: 'outbound',
                    createdAt: new Date().toISOString()
                }
            );

            // Update product quantity
            await databases.updateDocument(DATABASE_ID, 'products', data.productId, {
                quantity: product.quantity - data.quantity
            });

            return jsonResponse({ success: true, movement });
        }

        if (path === '/stats' && method === 'GET') {
            // Get dashboard statistics
            const products = await databases.listDocuments(DATABASE_ID, 'products');
            const movements = await databases.listDocuments(DATABASE_ID, 'movements');

            const stats = {
                totalProducts: products.total,
                totalStock: products.documents.reduce((sum, p) => sum + (p.quantity || 0), 0),
                lowStockCount: products.documents.filter(p => p.quantity < 10).length,
                todayInbound: movements.documents.filter(m => 
                    m.type === 'inbound' && 
                    new Date(m.createdAt).toDateString() === new Date().toDateString()
                ).length,
                todayOutbound: movements.documents.filter(m => 
                    m.type === 'outbound' && 
                    new Date(m.createdAt).toDateString() === new Date().toDateString()
                ).length
            };

            return jsonResponse(stats);
        }

        // Default response
        return jsonResponse({ message: 'WMS API v1.0', endpoints: ['/products', '/movements', '/stats'] });

    } catch (err) {
        error(err.message);
        return jsonResponse({ error: err.message }, 500);
    }
};
