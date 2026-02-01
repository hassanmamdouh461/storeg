// Initialize Appwrite
const { Client, Databases, ID, Query } = Appwrite;
let client;
let databases;
let isDemoMode = false;

// -------------------------------------------------------------
// Initialization & Config
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Hide Splash Screen after delay
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('hidden');
    }, 2500);

    // Check if AppConfig has values (hardcoded config)
    if (AppConfig.projectId && AppConfig.databaseId) {
        // Use hardcoded config - connect directly
        initAppwrite();
        document.getElementById('configModal').classList.remove('active');
    } else {
        // Check localStorage for saved config
        const savedProjectId = localStorage.getItem(STORAGE_KEYS.PROJECT_ID);
        const savedDbId = localStorage.getItem(STORAGE_KEYS.DB_ID);
        const savedMode = localStorage.getItem(STORAGE_KEYS.MODE);

        if (savedMode === 'demo') {
            useDemoMode();
        } else if (savedProjectId && savedDbId) {
            AppConfig.projectId = savedProjectId;
            AppConfig.databaseId = savedDbId;
            initAppwrite();
            document.getElementById('configModal').classList.remove('active');
        } else {
            // Show Config Modal
            document.getElementById('configModal').classList.add('active');
        }
    }
});

function saveConfig() {
    const projectId = document.getElementById('configProjectId').value.trim();
    const dbId = document.getElementById('configDbId').value.trim();

    if (!projectId || !dbId) {
        alert('يرجى إدخال البيانات المطلوبة');
        return;
    }

    localStorage.setItem(STORAGE_KEYS.PROJECT_ID, projectId);
    localStorage.setItem(STORAGE_KEYS.DB_ID, dbId);
    localStorage.setItem(STORAGE_KEYS.MODE, 'connected');

    AppConfig.projectId = projectId;
    AppConfig.databaseId = dbId;

    initAppwrite();
    document.getElementById('configModal').classList.remove('active');
}

function useDemoMode() {
    isDemoMode = true;
    localStorage.setItem(STORAGE_KEYS.MODE, 'demo');
    document.getElementById('configModal').classList.remove('active');
    document.getElementById('connectionStatus').textContent = '⚠️ وضع التجربة (Offline)';
    document.getElementById('connectionStatus').classList.remove('online');
    document.getElementById('connectionStatus').classList.add('offline');
    
    // Load initial demo data
    loadDashboard();
    loadProducts();
}

function initAppwrite() {
    client = new Client();
    client
        .setEndpoint(AppConfig.endpoint)
        .setProject(AppConfig.projectId);

    databases = new Databases(client);

    document.getElementById('connectionStatus').textContent = '✅ متصل بـ Appwrite';
    document.getElementById('connectionStatus').classList.add('online');
    document.getElementById('connectionStatus').classList.remove('offline');

    loadDashboard();
    loadProducts();
}

// -------------------------------------------------------------
// Navigation & UI
// -------------------------------------------------------------

function showModule(moduleId) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Update Content
    document.querySelectorAll('.module').forEach(el => el.classList.remove('active'));
    document.getElementById(moduleId).classList.add('active');
    
    // Update Title
    const titles = {
        'dashboard': 'لوحة المؤشرات',
        'inbound': 'الوارد (Inbound Operations)',
        'outbound': 'الصادر (Outbound Operations)',
        'products': 'المنتجات (Master Data)'
    };
    document.getElementById('pageTitle').textContent = titles[moduleId] || moduleId;

    // Load Data
    if (moduleId === 'inbound') loadInbound();
    if (moduleId === 'outbound') loadOutbound();
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    // Populate simple selects if needed
    if (modalId === 'inboundModal') populateProductSelect();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// -------------------------------------------------------------
// Data Services (Appwrite <-> LocalStorage Abstraction)
// -------------------------------------------------------------

async function getDocuments(collection) {
    if (isDemoMode) {
        return JSON.parse(localStorage.getItem(`wms_${collection}`) || '[]');
    } else {
        try {
            const response = await databases.listDocuments(AppConfig.databaseId, collection);
            return response.documents;
        } catch (error) {
            console.error('Appwrite Error:', error);
            alert('خطأ في الاتصال بقاعدة البيانات: ' + error.message);
            return [];
        }
    }
}

async function createDocument(collection, data) {
    if (isDemoMode) {
        const docs = JSON.parse(localStorage.getItem(`wms_${collection}`) || '[]');
        const newDoc = { $id: Date.now().toString(), ...data, $createdAt: new Date().toISOString() };
        docs.push(newDoc);
        localStorage.setItem(`wms_${collection}`, JSON.stringify(docs));
        return newDoc;
    } else {
        try {
            return await databases.createDocument(
                AppConfig.databaseId,
                collection,
                ID.unique(),
                data
            );
        } catch (error) {
            console.error('Appwrite Error:', error);
            alert('فشل الحفظ: ' + error.message);
            throw error;
        }
    }
}

// -------------------------------------------------------------
// Module: Dashboard
// -------------------------------------------------------------

async function loadDashboard() {
    const products = await getDocuments('products');
    const movements = await getDocuments('movements');

    const totalStock = products.reduce((acc, p) => acc + (parseInt(p.quantity) || 0), 0);
    const lowStock = products.filter(p => p.quantity < (p.min_stock || 10)).length;

    // TODO: Filter movements by today
    
    document.getElementById('dashTotalStock').textContent = totalStock;
    document.getElementById('dashAlerts').textContent = lowStock;
    document.getElementById('dashTodayInbound').textContent = movements.filter(m => m.type === 'inbound').length;
    document.getElementById('dashTodayOutbound').textContent = movements.filter(m => m.type === 'outbound').length;
}

// -------------------------------------------------------------
// Module: Products
// -------------------------------------------------------------

async function loadProducts() {
    const products = await getDocuments('products');
    const tbody = document.getElementById('productsList');
    tbody.innerHTML = '';

    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.sku || '-'}</td>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td><span class="status-badge ${p.quantity < 10 ? 'offline' : 'online'}">${p.quantity}</span></td>
            <td>${p.min_stock || 10}</td>
            <td>${p.price}</td>
        `;
        tbody.appendChild(tr);
    });
}

function populateProductSelect() {
    getDocuments('products').then(products => {
        const select = document.getElementById('inboundProductSelect');
        select.innerHTML = '<option value="">اختر المنتج...</option>';
        products.forEach(p => {
            select.innerHTML += `<option value="${p.$id}">${p.name}</option>`;
        });
    });
}

// Form Handlers
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
        name: fd.get('name'),
        sku: fd.get('sku'),
        category: fd.get('category'),
        price: parseFloat(fd.get('price')),
        quantity: 0 // Initial stock is 0
    };

    await createDocument('products', data);
    closeModal('productModal');
    loadProducts();
    loadDashboard();
    e.target.reset();
});

// -------------------------------------------------------------
// Module: Inbound
// -------------------------------------------------------------

async function loadInbound() {
    // In a real Appwrite setup, you would query 'movements' where type='inbound'
    // For demo, we sort of simple filter
    const movements = await getDocuments('movements');
    const inboundList = movements.filter(m => m.type === 'inbound');
    
    const tbody = document.getElementById('inboundList');
    tbody.innerHTML = '';

    inboundList.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${m.$id.substring(0, 5)}</td>
            <td>-</td>
            <td>${m.productName || 'منتج'}</td>
            <td>${m.quantity}</td>
            <td><span class="status-badge online">تم الاستلام</span></td>
            <td>${new Date(m.$createdAt).toLocaleDateString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('inboundForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('inboundProductSelect').value;
    const qty = parseInt(document.getElementById('inboundQty').value);
    
    if(!productId) return;

    // 1. Create movement record
    // We need product name for display (in real app we verify strict relations)
    const products = await getDocuments('products');
    const product = products.find(p => p.$id === productId);

    await createDocument('movements', {
        type: 'inbound',
        productId: productId,
        productName: product ? product.name : 'Unknown',
        quantity: qty,
        status: 'completed'
    });

    // 2. Update Product Stock
    // Note: In Appwrite, we'd typically use an updateDocument call here
    // For simplicity in this demo structure, we will just manually update local or remote
    
    if (isDemoMode) {
         product.quantity = (parseInt(product.quantity) || 0) + qty;
         // Save back to local storage
         localStorage.setItem('wms_products', JSON.stringify(products));
    } else {
        // Appwrite update
        const newQty = (product.quantity || 0) + qty;
        await databases.updateDocument(AppConfig.databaseId, 'products', productId, {
            quantity: newQty
        });
    }

    closeModal('inboundModal');
    loadInbound();
    loadDashboard();
    e.target.reset();
});

// -------------------------------------------------------------
// Module: Outbound (Placeholder)
// -------------------------------------------------------------

async function loadOutbound() {
    const tbody = document.getElementById('outboundList');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">جارٍ تحميل بيانات الصادر... (قريباً)</td></tr>';
}
