const AppConfig = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    // ⚠️ Note: The string below looks like an API Key. 
    // If connection fails, please check if this is your 'Project ID' (usually short, e.g., '65a...') 
    // and not an API Key.
    projectId: 'standard_253a65398abc6a72771513c01df771aab4e6b4b7518c08c8f9b9935e2861a82d2942a64b3e432b030e12f3d06ea420d661663a3aac884af3d108552da67af389e20bd982e55c9b1bd6ccfababb74c3e5a62bb3db5673bd0ef75fdb41a547a027e89784a41f8f043acb5a0b4fbd57ecbca82f9adbdb8154d87c9eac01b87ec348', 
    databaseId: '697fc081000d81aaaf3d'
};

// Keys for localStorage fallback
const STORAGE_KEYS = {
    PROJECT_ID: 'wms_project_id',
    DB_ID: 'wms_db_id',
    MODE: 'wms_mode' // 'demo' or 'connected'
};
