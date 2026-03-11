/* À ajouter à votre style.css */

/* Marqueurs */
.order-marker {
    position: relative;
}

.marker-content {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    border: 2px solid white;
    position: relative;
}

.urgent-pulse {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background: #EF4444;
    border-radius: 50%;
    border: 2px solid white;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
    100% { transform: scale(1); opacity: 1; }
}

.cluster-marker {
    background: #3B82F6;
    color: white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.depot-marker {
    font-size: 24px;
    background: white;
    border-radius: 50%;
    padding: 5px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

/* Popups */
.order-popup {
    min-width: 250px;
}

.popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E5E7EB;
}

.status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
}

.status-pending { background: #F3F4F6; color: #374151; }
.status-planned { background: #FEF3C7; color: #92400E; }
.status-urgent { background: #FEE2E2; color: #991B1B; }
.status-delivered { background: #D1FAE5; color: #065F46; }

.popup-address {
    margin-bottom: 8px;
    font-size: 13px;
    line-height: 1.4;
}

.popup-stats {
    background: #F3F4F6;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    margin: 10px 0;
}

.popup-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.btn-small {
    flex: 1;
    padding: 6px;
    border: 1px solid #E5E7EB;
    background: white;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-small:hover {
    background: #F3F4F6;
    border-color: #9CA3AF;
}

/* Liste des orders */
#orders-list {
    max-height: 400px;
    overflow-y: auto;
    padding: 10px;
}

.order-item {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    transition: all 0.2s;
}

.order-item:hover {
    border-color: #3B82F6;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.order-item.urgent {
    border-left: 4px solid #EF4444;
    background: #FEF2F2;
}

.order-item-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
}

.client-name {
    font-weight: 600;
    color: #111827;
}

.order-item-address {
    font-size: 13px;
    color: #6B7280;
    margin-bottom: 8px;
}

.order-item-details {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #9CA3AF;
    margin-bottom: 10px;
}

.order-item-actions {
    display: flex;
    gap: 6px;
}

/* Notifications Toast */
.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    border-left: 4px solid #3B82F6;
}

.toast-success { border-left-color: #10B981; }
.toast-error { border-left-color: #EF4444; }
.toast-warning { border-left-color: #F59E0B; }

.toast button {
    border: none;
    background: none;
    font-size: 20px;
    cursor: pointer;
    color: #9CA3AF;
}

.toast button:hover {
    color: #374151;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
