// WMS Pro - Enterprise Warehouse Management System
// Using Backend Function API

let isDemoMode = false;
let isConnected = false;

// -------------------------------------------------------------
// Initialization & Config
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // Hide Splash Screen after delay
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('hidden');
    }, 2500);

    // Hide config modal (we use Function API now)
    document.getElementById('configModal').classList.remove('active');
    
    // Test API connection
    await initAPI();
});

async function initAPI() {
    try {
        updateConnectionStatus('جاري الاتصال...', 'connecting');
        
        // Test connection to Function API
        const response = await fetch(AppConfig.apiUrl + '/');
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        console.log('API Connected:', data);
        
        isConnected = true;
        updateConnectionStatus('متصل', 'online');
        
        // Load initial data
        await loadDashboard();
        await loadProducts();
        
    } catch (error) {
        console.error('API Connection Error:', error);
        updateConnectionStatus('غير متصل', 'offline');
        
        // Fallback to demo mode
        const useDemo = confirm('فشل الاتصال بالسيرفر.\nهل تريد استخدام وضع التجربة؟');
        if (useDemo) {
            useDemoMode();
        }
    }
}

function updateConnectionStatus(text, status) {
    const el = document.getElementById('connectionStatus');
    const icons = {
        'online': 'ri-wifi-line',
        'offline': 'ri-wifi-off-line',
        'connecting': 'ri-loader-4-line'
    };
    el.innerHTML = `<i class="${icons[status] || icons.offline}"></i> ${text}`;
    el.className = 'status-badge ' + status;
}

function useDemoMode() {
    isDemoMode = true;
    isConnected = false;
    localStorage.setItem(STORAGE_KEYS.MODE, 'demo');
    updateConnectionStatus('وضع التجربة', 'offline');
    
    // Load initial demo data
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
        'products': 'المنتجات (Master Data)',
        'inventory': 'جرد المخزون',
        'suppliers': 'الموردين والعملاء'
    };
    document.getElementById('pageTitle').textContent = titles[moduleId] || moduleId;

    // Load Data
    if (moduleId === 'inbound') loadInbound();
    if (moduleId === 'outbound') loadOutbound();
    if (moduleId === 'dashboard') loadDashboard();
    if (moduleId === 'products') loadProducts();
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'inboundModal' || modalId === 'outboundModal') {
        populateProductSelect(modalId === 'outboundModal' ? 'outboundProductSelect' : 'inboundProductSelect');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// -------------------------------------------------------------
// API Services
// -------------------------------------------------------------

async function apiRequest(endpoint, method = 'GET', data = null) {
    if (isDemoMode) {
        return handleDemoRequest(endpoint, method, data);
    }
    
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(AppConfig.apiUrl + endpoint, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function handleDemoRequest(endpoint, method, data) {
    // Demo mode - use localStorage
    const collection = endpoint.split('/')[1]; // e.g., /products -> products
    
    if (method === 'GET') {
        const docs = JSON.parse(localStorage.getItem(`wms_${collection}`) || '[]');
        return { documents: docs, total: docs.length };
    }
    
    if (method === 'POST') {
        const docs = JSON.parse(localStorage.getItem(`wms_${collection}`) || '[]');
        const newDoc = { 
            $id: Date.now().toString(), 
            ...data, 
            $createdAt: new Date().toISOString() 
        };
        docs.push(newDoc);
        localStorage.setItem(`wms_${collection}`, JSON.stringify(docs));
        return newDoc;
    }
    
    return {};
}

async function getDocuments(collection) {
    try {
        const result = await apiRequest(`/${collection}`);
        return result.documents || result || [];
    } catch (error) {
        console.error(`Error fetching ${collection}:`, error);
        return [];
    }
}

async function createDocument(collection, data) {
    try {
        return await apiRequest(`/${collection}`, 'POST', data);
    } catch (error) {
        alert('فشل الحفظ: ' + error.message);
        throw error;
    }
}

// -------------------------------------------------------------
// Module: Dashboard
// -------------------------------------------------------------

async function loadDashboard() {
    try {
        if (isDemoMode) {
            const products = await getDocuments('products');
            const movements = await getDocuments('movements');
            
            const totalStock = products.reduce((acc, p) => acc + (parseInt(p.quantity) || 0), 0);
            const lowStock = products.filter(p => (p.quantity || 0) < (p.minStock || 10)).length;
            
            document.getElementById('dashTotalStock').textContent = totalStock;
            document.getElementById('dashAlerts').textContent = lowStock;
            document.getElementById('dashTodayInbound').textContent = movements.filter(m => m.type === 'inbound').length;
            document.getElementById('dashTodayOutbound').textContent = movements.filter(m => m.type === 'outbound').length;
        } else {
            // Use stats endpoint for connected mode
            const stats = await apiRequest('/stats');
            document.getElementById('dashTotalStock').textContent = stats.totalStock || 0;
            document.getElementById('dashAlerts').textContent = stats.lowStockCount || 0;
            document.getElementById('dashTodayInbound').textContent = stats.todayInbound || 0;
            document.getElementById('dashTodayOutbound').textContent = stats.todayOutbound || 0;
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// -------------------------------------------------------------
// Module: Products
// -------------------------------------------------------------

async function loadProducts() {
    const products = await getDocuments('products');
    const tbody = document.getElementById('productsList');
    tbody.innerHTML = '';

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">لا توجد منتجات بعد. أضف منتجاً جديداً!</td></tr>';
        return;
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        const qty = parseInt(p.quantity) || 0;
        const minStock = parseInt(p.minStock) || 10;
        const isLow = qty < minStock;
        
        tr.innerHTML = `
            <td>${p.sku || '-'}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.category || '-'}</td>
            <td><span class="status-badge ${isLow ? 'warning' : 'online'}">${qty}</span></td>
            <td>${minStock}</td>
            <td>${p.price || 0} ج.م</td>
        `;
        tbody.appendChild(tr);
    });
}

async function populateProductSelect(selectId = 'inboundProductSelect') {
    const products = await getDocuments('products');
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">اختر المنتج...</option>';
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.$id;
        opt.textContent = `${p.name} (المتاح: ${p.quantity || 0})`;
        select.appendChild(opt);
    });
}

// Product Form Handler
document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
        name: fd.get('name'),
        sku: fd.get('sku'),
        category: fd.get('category'),
        price: parseFloat(fd.get('price')) || 0,
        quantity: 0,
        minStock: 10
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
    const movements = await getDocuments('movements');
    const inboundList = movements.filter(m => m.type === 'inbound');
    
    const tbody = document.getElementById('inboundList');
    tbody.innerHTML = '';

    if (inboundList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">لا توجد عمليات استلام بعد</td></tr>';
        return;
    }

    inboundList.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${(m.$id || '').substring(0, 6)}</td>
            <td>-</td>
            <td>${m.productName || 'منتج'}</td>
            <td>${m.quantity}</td>
            <td><span class="status-badge online">تم الاستلام</span></td>
            <td>${new Date(m.$createdAt || m.createdAt).toLocaleDateString('ar-EG')}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('inboundForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('inboundProductSelect').value;
    const qty = parseInt(document.getElementById('inboundQty').value);
    
    if (!productId || !qty) {
        alert('يرجى اختيار المنتج وإدخال الكمية');
        return;
    }

    try {
        // Get product name
        const products = await getDocuments('products');
        const product = products.find(p => p.$id === productId);
        
        if (isDemoMode) {
            // Update product quantity locally
            product.quantity = (parseInt(product.quantity) || 0) + qty;
            localStorage.setItem('wms_products', JSON.stringify(products));
            
            // Create movement record
            await createDocument('movements', {
                type: 'inbound',
                productId,
                productName: product.name,
                quantity: qty
            });
        } else {
            // Use API endpoint
            await apiRequest('/movements/inbound', 'POST', {
                productId,
                productName: product?.name || 'منتج',
                quantity: qty
            });
        }

        closeModal('inboundModal');
        loadInbound();
        loadDashboard();
        e.target.reset();
    } catch (error) {
        console.error('Inbound error:', error);
    }
});

// -------------------------------------------------------------
// Module: Outbound
// -------------------------------------------------------------

async function loadOutbound() {
    const movements = await getDocuments('movements');
    const outboundList = movements.filter(m => m.type === 'outbound');
    
    const tbody = document.getElementById('outboundList');
    tbody.innerHTML = '';

    if (outboundList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">لا توجد عمليات صرف بعد</td></tr>';
        return;
    }

    outboundList.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${(m.$id || '').substring(0, 6)}</td>
            <td>${m.productName || 'منتج'}</td>
            <td>${m.quantity}</td>
            <td><span class="status-badge online">تم الصرف</span></td>
            <td>${new Date(m.$createdAt || m.createdAt).toLocaleDateString('ar-EG')}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('outboundForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('outboundProductSelect').value;
    const qty = parseInt(document.getElementById('outboundQty').value);
    
    if (!productId || !qty) {
        alert('يرجى اختيار المنتج وإدخال الكمية');
        return;
    }

    try {
        const products = await getDocuments('products');
        const product = products.find(p => p.$id === productId);
        
        if (!product) {
            alert('المنتج غير موجود');
            return;
        }
        
        const currentQty = parseInt(product.quantity) || 0;
        if (currentQty < qty) {
            alert(`الكمية المتاحة (${currentQty}) أقل من المطلوبة (${qty})`);
            return;
        }

        if (isDemoMode) {
            product.quantity = currentQty - qty;
            localStorage.setItem('wms_products', JSON.stringify(products));
            
            await createDocument('movements', {
                type: 'outbound',
                productId,
                productName: product.name,
                quantity: qty
            });
        } else {
            await apiRequest('/movements/outbound', 'POST', {
                productId,
                productName: product.name,
                quantity: qty
            });
        }

        closeModal('outboundModal');
        loadOutbound();
        loadDashboard();
        loadProducts();
        e.target.reset();
    } catch (error) {
        console.error('Outbound error:', error);
    }
});

// -------------------------------------------------------------
// Utility Functions
// -------------------------------------------------------------

function saveConfig() {
    // Legacy function - kept for compatibility
    const projectId = document.getElementById('configProjectId')?.value?.trim();
    const dbId = document.getElementById('configDbId')?.value?.trim();
    
    if (projectId && dbId) {
        localStorage.setItem(STORAGE_KEYS.PROJECT_ID, projectId);
        localStorage.setItem(STORAGE_KEYS.DB_ID, dbId);
    }
    
    document.getElementById('configModal').classList.remove('active');
    initAPI();
}
