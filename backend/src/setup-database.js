/**
 * Database Setup Script
 * Run this script to create all required collections in Appwrite
 * 
 * Usage: npm run setup-db
 */

import { Client, Databases, ID } from 'node-appwrite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env file manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && !key.startsWith('#')) {
        process.env[key.trim()] = values.join('=').trim();
    }
});

// Configuration
const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

console.log('🔧 إعداد قاعدة البيانات...');
console.log(`📡 Endpoint: ${ENDPOINT}`);
console.log(`📁 Project: ${PROJECT_ID}`);
console.log(`🗄️ Database: ${DATABASE_ID}`);

// Initialize Client
const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

// Collection Schemas
const collections = [
    {
        $id: 'products',
        name: 'المنتجات (Products)',
        attributes: [
            { key: 'name', type: 'string', size: 255, required: true },
            { key: 'sku', type: 'string', size: 50, required: false },
            { key: 'category', type: 'string', size: 100, required: false },
            { key: 'quantity', type: 'integer', required: true, default: 0 },
            { key: 'price', type: 'float', required: false },
            { key: 'minStock', type: 'integer', required: false, default: 10 },
            { key: 'description', type: 'string', size: 1000, required: false }
        ]
    },
    {
        $id: 'movements',
        name: 'الحركات المخزنية (Movements)',
        attributes: [
            { key: 'productId', type: 'string', size: 36, required: true },
            { key: 'productName', type: 'string', size: 255, required: false },
            { key: 'type', type: 'string', size: 20, required: true }, // inbound, outbound
            { key: 'quantity', type: 'integer', required: true },
            { key: 'reason', type: 'string', size: 100, required: false },
            { key: 'createdAt', type: 'string', size: 30, required: false },
            { key: 'status', type: 'string', size: 20, required: false, default: 'completed' }
        ]
    },
    {
        $id: 'suppliers',
        name: 'الموردين (Suppliers)',
        attributes: [
            { key: 'name', type: 'string', size: 255, required: true },
            { key: 'phone', type: 'string', size: 20, required: false },
            { key: 'email', type: 'string', size: 255, required: false },
            { key: 'address', type: 'string', size: 500, required: false },
            { key: 'type', type: 'string', size: 20, required: false } // supplier, customer
        ]
    }
];

async function createCollection(collectionDef) {
    const { $id, name, attributes } = collectionDef;
    
    try {
        // Try to create collection
        console.log(`\n📦 إنشاء مجموعة: ${name}...`);
        
        await databases.createCollection(
            DATABASE_ID,
            $id,
            name,
            [
                // Permissions: anyone can read, only authenticated users can write
                'read("any")',
                'create("users")',
                'update("users")',
                'delete("users")'
            ]
        );
        console.log(`   ✅ تم إنشاء المجموعة: ${$id}`);

        // Create attributes
        for (const attr of attributes) {
            console.log(`   📝 إضافة حقل: ${attr.key}...`);
            
            try {
                if (attr.type === 'string') {
                    await databases.createStringAttribute(
                        DATABASE_ID,
                        $id,
                        attr.key,
                        attr.size,
                        attr.required,
                        attr.default || null
                    );
                } else if (attr.type === 'integer') {
                    await databases.createIntegerAttribute(
                        DATABASE_ID,
                        $id,
                        attr.key,
                        attr.required,
                        null, // min
                        null, // max
                        attr.default || null
                    );
                } else if (attr.type === 'float') {
                    await databases.createFloatAttribute(
                        DATABASE_ID,
                        $id,
                        attr.key,
                        attr.required,
                        null, // min
                        null, // max
                        attr.default || null
                    );
                }
                console.log(`      ✅ تم إضافة: ${attr.key}`);
            } catch (attrErr) {
                console.log(`      ⚠️ ${attr.key}: ${attrErr.message}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }

    } catch (err) {
        if (err.code === 409) {
            console.log(`   ⚠️ المجموعة موجودة بالفعل: ${$id}`);
        } else {
            console.log(`   ❌ خطأ: ${err.message}`);
        }
    }
}

async function main() {
    console.log('\n🚀 بدء إعداد قاعدة البيانات...\n');
    
    for (const collection of collections) {
        await createCollection(collection);
    }
    
    console.log('\n✅ اكتمل الإعداد!');
    console.log('📊 المجموعات المُنشأة:');
    console.log('   - products (المنتجات)');
    console.log('   - movements (الحركات)');
    console.log('   - suppliers (الموردين)');
    console.log('\n🎉 يمكنك الآن استخدام النظام!');
}

main().catch(console.error);
