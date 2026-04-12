let qrScanner = null;
let scanCount = 0;
const MAX_SCANS = 10; // Nombre maximum de scans en cascade

async function startScanner() {
    try {
        const videoElement = document.getElementById('scanner-video');
        const resultDiv = document.getElementById('scanner-result');
        
        // Vérifier si on est en HTTPS (obligatoire pour la caméra sur mobile)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            throw new Error('La caméra nécessite une connexion HTTPS. Ouvrez cette page via le domaine sécurisé du site.');
        }
        
        // Vérifier si le navigateur supporte les permissions
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Votre navigateur ne supporte pas l\'accès à la caméra');
        }
        
        // Afficher un message de chargement
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p style="color: blue;">🔄 Initialisation de la caméra...</p>';
        
        // Arrêter le scanner précédent s'il existe
        if (qrScanner) {
            qrScanner.destroy();
        }
        
        // Méthode alternative: utiliser directement getUserMedia pour Samsung
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            
            // Afficher directement le stream dans la vidéo
            videoElement.srcObject = stream;
            videoElement.style.display = 'block';
            videoElement.style.visibility = 'visible';
            
            // Attendre que la vidéo soit prête
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resultDiv.innerHTML = '<p style="color: green;">📷 Caméra active - Utilisation du mode manuel</p>';
                resultDiv.innerHTML += '<p style="font-size: 12px;">Cliquez sur "📸 Capturer QR" pour analyser un code</p>';
            };
            
        } catch (streamError) {
            // Si le stream direct échoue, essayer QR-Scanner
            resultDiv.innerHTML = '<p style="color: orange;">🔄 Tentative avec QR-Scanner...</p>';
            
            qrScanner = new QrScanner(
                videoElement,
                result => handleScanResult(result),
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    preferredCamera: 'environment',
                    maxScansPerSecond: 5
                }
            );
            
            await qrScanner.start();
            resultDiv.innerHTML = '<p style="color: green;">📷 Scanner QR actif - Pointez un QR code</p>';
        }
        
    } catch (error) {
        console.error('Erreur lors du démarrage du scanner:', error);
        const resultDiv = document.getElementById('scanner-result');
        resultDiv.style.display = 'block';
        
        // Messages d'erreur détaillés
        if (error.name === 'NotAllowedError') {
            resultDiv.innerHTML = `
                <p style="color: red;">❌ Permission caméra refusée</p>
                <p style="font-size: 12px; margin-top: 10px;">
                    <strong>Solution pour Samsung:</strong><br>
                    1. Paramètres → Applications<br>
                    2. Chrome/Edge → Permissions → Caméra → Autoriser<br>
                    3. Redémarrez le navigateur<br>
                    4. Essayez l'option "Scanner manuel" ci-dessous
                </p>
                <button onclick="startManualCamera()" style="margin-top: 10px; padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 5px;">📷 Scanner manuel</button>
            `;
        } else if (error.name === 'NotFoundError') {
            resultDiv.innerHTML = `
                <p style="color: red;">❌ Aucune caméra trouvée</p>
                <p style="font-size: 12px;">Vérifiez que votre caméra fonctionne.</p>
                <button onclick="startManualCamera()" style="margin-top: 10px; padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 5px;">📷 Scanner manuel</button>
            `;
        } else {
            resultDiv.innerHTML = `
                <p style="color: red;">❌ Erreur: ${error.message}</p>
                <button onclick="startManualCamera()" style="margin-top: 10px; padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 5px;">📷 Scanner manuel</button>
            `;
        }
    }
}

// Fonction alternative pour scanner manuel
async function startManualCamera() {
    try {
        const videoElement = document.getElementById('scanner-video');
        const resultDiv = document.getElementById('scanner-result');
        
        resultDiv.innerHTML = '<p style="color: blue;">🔄 Démarrage caméra manuelle...</p>';
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        
        videoElement.srcObject = stream;
        videoElement.style.display = 'block';
        videoElement.style.visibility = 'visible';
        
        videoElement.onloadedmetadata = () => {
            videoElement.play();
            resultDiv.innerHTML = `
                <p style="color: green;">📷 Caméra manuelle active</p>
                <p style="font-size: 12px;">Prenez une photo du QR code et elle sera analysée automatiquement</p>
                <button onclick="captureQR()" style="margin-top: 10px; padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 5px;">📸 Capturer QR</button>
            `;
        };
        
    } catch (error) {
        const resultDiv = document.getElementById('scanner-result');
        resultDiv.innerHTML = `<p style="color: red;">❌ Erreur caméra manuelle: ${error.message}</p>`;
    }
}

// Fonction pour capturer et analyser un QR code depuis une photo
function captureQR() {
    const videoElement = document.getElementById('scanner-video');
    const resultDiv = document.getElementById('scanner-result');
    
    try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);
        
        // Utiliser jsQR pour analyser l'image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Si jsQR n'est pas disponible, utiliser une méthode alternative
        if (typeof window.jsQR !== 'undefined') {
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                handleScanResult({ data: code.data });
                resultDiv.innerHTML += '<p style="color: green;">✅ QR Code détecté!</p>';
            } else {
                resultDiv.innerHTML += '<p style="color: orange;">⚠️ Aucun QR Code détecté, réessayez</p>';
            }
        } else {
            // Alternative: demander à l'utilisateur d'entrer le code manuellement
            resultDiv.innerHTML += `
                <p style="color: orange;">⚠️ Analyse automatique non disponible</p>
                <input type="text" id="manualQR" placeholder="Entrez le QR code manuellement" style="width: 100%; margin: 10px 0; padding: 5px;">
                <button onclick="processManualQR()" style="padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px;">Traiter</button>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML += `<p style="color: red;">❌ Erreur capture: ${error.message}</p>`;
    }
}

// Fonction pour traiter un QR code entré manuellement
function processManualQR() {
    const manualInput = document.getElementById('manualQR');
    if (manualInput && manualInput.value) {
        handleScanResult({ data: manualInput.value });
    }
}

function handleScanResult(result) {
    scanCount++;
    const resultDiv = document.getElementById('scanner-result');
    
    // Afficher le résultat du scan
    resultDiv.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Scan #${scanCount}:</strong><br>
            <code style="background: #e0e0e0; padding: 5px; border-radius: 3px; display: block; margin-top: 5px;">
                ${result.data}
            </code>
        </div>
    `;
    
    // Traiter les données du QR code
    processQRCodeData(result.data);
    
    // Continuer le scanning si on n'a pas atteint la limite
    if (scanCount < MAX_SCANS) {
        setTimeout(() => {
            resultDiv.innerHTML += '<p style="color: blue;">🔄 Prêt pour le prochain scan...</p>';
        }, 1000);
    } else {
        resultDiv.innerHTML += '<p style="color: orange;">⚠️ Limite de scans atteinte. Redémarrez pour continuer.</p>';
        stopScanner();
    }
}

function processQRCodeData(data) {
    try {
        // Analyser les données du QR code
        // Format attendu: "invoice:ID" ou "client:EMAIL" ou "product:CODE"
        
        if (data.startsWith('invoice:')) {
            const invoiceId = data.replace('invoice:', '');
            loadInvoiceFromQR(invoiceId);
        } else if (data.startsWith('client:')) {
            const clientEmail = data.replace('client:', '');
            loadClientFromQR(clientEmail);
        } else if (data.startsWith('product:')) {
            const productCode = data.replace('product:', '');
            loadProductFromQR(productCode);
        } else {
            // Traitement générique
            console.log('QR Code scanné:', data);
        }
    } catch (error) {
        console.error('Erreur lors du traitement des données QR:', error);
    }
}

async function loadInvoiceFromQR(invoiceId) {
    try {
        const { data, error } = await supabaseClient
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();
            
        if (error) throw error;
        
        // Remplir le formulaire avec les données de la facture
        document.getElementById('client').value = data.client;
        document.getElementById('amount').value = data.amount;
        document.getElementById('status').value = data.status;
        
        // Ouvrir la modale de facture
        openModal();
        
        alert(`Facture ${data.invoice_number} chargée depuis le QR code`);
        
    } catch (error) {
        console.error('Erreur lors du chargement de la facture:', error);
        alert('Erreur: Impossible de charger la facture depuis le QR code');
    }
}

async function loadClientFromQR(clientEmail) {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('email', clientEmail)
            .single();
            
        if (error) throw error;
        
        // Remplir le formulaire client
        document.getElementById('company').value = data.company || '';
        document.getElementById('email').value = data.email || '';
        document.getElementById('phone').value = data.phone || '';
        document.getElementById('street').value = data.street || '';
        document.getElementById('postal_code').value = data.postal_code || '';
        document.getElementById('city').value = data.city || '';
        document.getElementById('country').value = data.country || '';
        document.getElementById('notes').value = data.notes || '';
        
        // Ouvrir la modale client
        openClientModal();
        
        alert(`Client ${data.company} chargé depuis le QR code`);
        
    } catch (error) {
        console.error('Erreur lors du chargement du client:', error);
        alert('Erreur: Impossible de charger le client depuis le QR code');
    }
}

async function loadProductFromQR(productCode) {
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('code', productCode)
            .single();
            
        if (error) throw error;
        
        // Ajouter le produit à la facture actuelle
        if (document.getElementById('invoiceModal').style.display === 'flex') {
            addItem();
            const lastRow = document.querySelectorAll('.item-row')[document.querySelectorAll('.item-row').length - 1];
            const productSelect = lastRow.querySelector('.product');
            const priceInput = lastRow.querySelector('.price');
            
            productSelect.value = data.price;
            priceInput.value = data.price;
            calculateTotal();
        } else {
            alert(`Produit ${data.name} scanné. Ouvrez d'abord une nouvelle facture.`);
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement du produit:', error);
        alert('Erreur: Impossible de charger le produit depuis le QR code');
    }
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
        qrScanner = null;
    }
    
    const videoElement = document.getElementById('scanner-video');
    if (videoElement) {
        videoElement.srcObject = null;
    }
    
    const resultDiv = document.getElementById('scanner-result');
    if (resultDiv) {
        resultDiv.innerHTML = '<p style="color: gray;">Scanner arrêté</p>';
    }
    
    scanCount = 0;
}

// Fonction pour générer des QR codes
function generateQRCode(type, data) {
    const qrData = `${type}:${data}`;
    
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, qrData, function (error) {
        if (error) console.error(error);
        return canvas;
    });
    
    return canvas;
}
