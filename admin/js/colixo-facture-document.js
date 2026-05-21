(function(){'use strict';
    function loadQRLib() {
        return new Promise((resolve) => {
            if(typeof QRCode !== 'undefined') { resolve(); return; }
            if(document.getElementById('qrcodeLib')) {
                // Déjà en cours de chargement — attendre
                let tries = 0;
                const check = setInterval(() => {
                    if(typeof QRCode !== 'undefined' || ++tries > 30) { clearInterval(check); resolve(); }
                }, 100);
                return;
            }
            const s = document.createElement('script');
            s.id = 'qrcodeLib';
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            s.onload = () => resolve();
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
    }

    function fmt(v) {
        return parseFloat(v || 0).toFixed(2);
    }

    function splitStreetAndBuilding(address) {
        const value = String(address || '').trim();
        if (!value) return { street: '', building: '' };
        const m = value.match(/^(.*?)(?:\s+)(\d[\dA-Za-z\-\/]*)$/);
        if (!m) return { street: value.slice(0, 70), building: '' };
        return { street: m[1].trim().slice(0, 70), building: m[2].trim().slice(0, 16) };
    }
    function buildQRRef(numero) {
        const seed = (numero || '').replace(/\D/g, '').slice(-26).padStart(26, '0');
        const digits = /[1-9]/.test(seed) ? seed : `${seed.slice(0, 25)}1`;
        const table = [0,9,4,6,8,2,7,1,3,5];
        let carry = 0;
        for (const d of digits) carry = table[(carry + parseInt(d, 10)) % 10];
        return digits + ((10 - carry) % 10);
    }

    async function generateQrBillBase64ForFacture(f, ent) {
        let qrBillBase64 = '';
        const creditor = splitStreetAndBuilding('Yverdon-les-Bains');
        const debtor = splitStreetAndBuilding(ent.adresse || '');
        const qrRef = buildQRRef(f.numero || f.id || `FAC-${new Date().getFullYear()}-0001`);
        try {
            await loadQRLib();
            const spcData = [
                'SPC','0200','1',
                'CH953000529114788940K',
                'S','Didier Gysling', (creditor.street||'Yvonand').substring(0,70), (creditor.building||'').substring(0,16), '1462','Yvonand','CH',
                '','','','','','','',
                fmt(f.montant_ttc),'CHF',
                'S', (ent.nom||'').substring(0,70), (debtor.street||ent.adresse||'').substring(0,70), (debtor.building||'').substring(0,16),
                (ent.npa||'').substring(0,16), (ent.ville||'').substring(0,35), 'CH',
                'QRR', qrRef, ('Facture '+f.numero).substring(0,140),
                'EPD',''
            ].join('\n');
            if(typeof QRCode !== 'undefined') {
                const tmpDiv = document.createElement('div');
                tmpDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
                document.body.appendChild(tmpDiv);
                await new Promise((resolve) => {
                    const qr = new QRCode(tmpDiv, {
                        text: spcData,
                        width: 160, height: 160,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.M
                    });
                    setTimeout(() => {
                        const canvas = tmpDiv.querySelector('canvas');
                        const img = tmpDiv.querySelector('img');
                        if(canvas) qrBillBase64 = canvas.toDataURL('image/png');
                        else if(img) qrBillBase64 = img.src;
                        document.body.removeChild(tmpDiv);
                        resolve();
                    }, 80);
                });
            }
        } catch(e) { console.warn('QR Bill:', e); }
        return qrBillBase64;
    }

    function buildFactureHtmlDocument(f, lignes, ent, qrBillBase64, forEmail) {
        const qrRef = buildQRRef(f.numero || f.id || `FAC-${new Date().getFullYear()}-0001`);
        const logoPath = (typeof window !== 'undefined' && typeof window.colixoHref === 'function')
            ? window.colixoHref('/images/colixo-logo-print.png')
            : (((typeof window !== 'undefined' && window.COLIXO_BASE_PATH) ? String(window.COLIXO_BASE_PATH) : '') + '/images/colixo-logo-print.png');
        const logoUrl = (function(){
            try {
                return (typeof window !== 'undefined' && window.location)
                    ? new URL(logoPath, window.location.href).href
                    : logoPath;
            }
            catch(e){ return logoPath; }
        })();
        const totalColis = Array.isArray(lignes) && lignes.length
            ? lignes.reduce((sum, l) => sum + (parseInt(l?.quantite, 10) || 1), 0)
            : (parseInt(f?.nb_colis, 10) || 0);
        const printButtons = `<br><button onclick="window.print()" style="background:#e8311a;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-right:8px;">🖨 Imprimer / PDF</button>
        <button onclick="window.close()" style="background:#f3f4f6;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;">Fermer</button>`;
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
            body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#1a1a1a;font-size:13px;}
            .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;}
            .logo-wrap{display:flex;align-items:flex-start;gap:16px;}
            .logo-img{max-height:56px;max-width:240px;object-fit:contain;display:block;}
            .logo-fallback{font-size:28px;font-weight:900;color:#e8311a;letter-spacing:2px;}
            .logo-fallback span{color:#1a1a1a;}
            .facture-num{font-size:22px;font-weight:700;color:#e8311a;text-align:right;}
            .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:30px;}
            .info-box h4{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px;}
            .info-box p{margin:3px 0;line-height:1.6;}
            table{width:100%;border-collapse:collapse;margin-bottom:24px;}
            th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;border-bottom:2px solid #e5e7eb;}
            td{padding:9px 12px;border-bottom:1px solid #f3f4f6;vertical-align:middle;}
            tr:last-child td{border-bottom:none;}
            .totaux{display:flex;justify-content:flex-end;margin-bottom:24px;}
            .totaux table{width:320px;}
            .totaux td{padding:6px 12px;}
            .total-ttc{background:#e8311a;color:white;font-weight:700;font-size:16px;}
            .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;}
            .badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600;}
            @media print{body{padding:20px;}button{display:none;}}
        </style></head><body>
        <div class="header">
            <div>
                <div class="logo-wrap">
                    <img src="${logoUrl}" alt="Colixo" class="logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <div class="logo-fallback" style="display:none;">COLIXO<span> — Didier Gysling</span></div>
                </div>
                <p style="color:#6b7280;margin-top:6px;">Transport express — Suisse romande<br>Impasse des Griottes 3<br>1462 Yvonand • TVA CHE-499.684.981</p>
            </div>
            <div style="text-align:right;">
                <div class="facture-num">FACTURE ${f.numero}</div>
                <p style="color:#6b7280;margin-top:6px;">Émise le ${new Date(f.created_at).toLocaleDateString('fr-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit',year:'numeric'})}<br>
                Échéance : <strong style="color:#e8311a">${new Date(f.echeance_date).toLocaleDateString('fr-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit',year:'numeric'})}</strong></p>
            </div>
        </div>
        <div class="info-grid">
            <div class="info-box">
                <h4>Émetteur</h4>
                <p><strong>Didier Gysling</strong><br>
                Colixo<br>
                Impasse des Griottes 3<br>
                1462 Yvonand<br>
                Suisse<br>
                <span style="color:#6b7280;font-size:11px;">N° TVA : CHE-499.684.981</span></p>
            </div>
            <div class="info-box">
                <h4>Facturé à</h4>
                <p><strong>${ent.nom||'—'}</strong><br>
                ${ent.adresse?ent.adresse+'<br>':''}
                ${ent.npa||''} ${ent.ville||''}<br>
                ${ent.email?'<a href="mailto:'+ent.email+'">'+ent.email+'</a>':''}</p>
            </div>
        </div>
        <p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;color:#c2410c;font-size:12px;margin-bottom:20px;">
            📅 Période : <strong>${new Date(f.periode_debut).toLocaleDateString('fr-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'long'})} au ${new Date(f.periode_fin).toLocaleDateString('fr-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'long',year:'numeric'})}</strong>
            &nbsp;|&nbsp; ${totalColis} colis livrés
        </p>
        <table>
            <thead><tr><th>Commande</th><th>Livré le</th><th>Destinataire</th><th>Poids</th><th>Service</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead>
            <tbody>${(lignes||[]).map(l=>{
                const svc=l.description?.match(/eco|express|urgent|prioritaire/i)?.[0]||'eco';
                return `<tr>
                    <td><strong>${l.order_number||'—'}</strong></td>
                    <td>${l.delivered_at?new Date(l.delivered_at).toLocaleDateString('fr-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'2-digit'}):'-'}</td>
                    <td style="color:#6b7280;font-size:12px;">${(l.description||'').replace(/^[^—]*— /,'')}</td>
                    <td>${l.poids||0}kg</td>
                    <td>${l.suppl_service>0?l.suppl_service===1?'Prioritaire':l.suppl_service===5?'Express':'Urgent':'Éco'}</td>
                    <td>${l.quantite||1}</td>
                    <td>${fmt(l.prix_unitaire+l.suppl_service)} CHF</td>
                    <td><strong>${fmt(l.total)} CHF</strong></td>
                </tr>`;
            }).join('')}</tbody>
        </table>
        <div class="totaux"><table>
            <tr><td>Montant HT</td><td style="text-align:right"><strong>${fmt(f.montant_ht)} CHF</strong></td></tr>
            ${f.remise_pct>0?`<tr style="color:#16a34a"><td>Remise volume ${f.remise_pct}%</td><td style="text-align:right">-${fmt(f.remise_mnt)} CHF</td></tr>`:''}
            <tr><td>Montant net HT</td><td style="text-align:right">${fmt(f.montant_net)} CHF</td></tr>
            <tr><td>TVA 8.1%</td><td style="text-align:right">${fmt(f.tva_mnt)} CHF</td></tr>
            <tr class="total-ttc"><td style="border-radius:4px 0 0 4px">TOTAL TTC</td><td style="text-align:right;border-radius:0 4px 4px 0">${fmt(f.montant_ttc)} CHF</td></tr>
        </table></div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:20px;">
            <strong>Conditions de paiement :</strong> ${f.conditions_paiement||'Net 30 jours'}<br>
            <span style="color:#6b7280;font-size:12px;">Échéance au ${new Date(f.echeance_date).toLocaleDateString('fr-CH',{timeZone:'Europe/Zurich',day:'2-digit',month:'long',year:'numeric'})}</span>
        </div>
        <div class="footer">Didier Gysling — Colixo • Impasse des Griottes 3 • 1462 Yvonand • N° TVA CHE-499.684.981 • Merci pour votre confiance</div>

        <!-- ══ QR BILL SUISSE ══ -->
        <div style="page-break-before:always;"></div>
        <div style="border:1px solid #000;font-family:Arial,sans-serif;max-width:210mm;margin:20px auto;">
            <!-- Ligne de séparation perforée -->
            <div style="text-align:center;font-size:9px;color:#666;border-bottom:1px dashed #000;padding:4px;letter-spacing:2px;">✂ &nbsp; SECTION DE PAIEMENT — COUPER ICI &nbsp; ✂</div>

            <div style="display:flex;">
                <!-- Partie gauche: Récépissé -->
                <div style="width:62mm;border-right:1px solid #000;padding:5mm;font-size:8pt;">
                    <div style="font-weight:bold;font-size:11pt;margin-bottom:3mm;">Récépissé</div>

                    <div style="font-size:7pt;font-weight:bold;color:#666;margin-bottom:1mm;">Compte / Payable à</div>
                    <div style="font-size:8pt;margin-bottom:3mm;">
                        <strong>CH95 3000 5291 1478 8940 K</strong><br>
                        Didier Gysling<br>
                        Colixo<br>
                        Impasse des Griottes 3<br>
                        1462 Yvonand<br>
                        <span style="font-size:7pt;">TVA CHE-499.684.981</span>
                    </div>

                    <div style="font-size:7pt;font-weight:bold;color:#666;margin-bottom:1mm;">Payable par</div>
                    <div style="font-size:8pt;margin-bottom:3mm;">
                        ${ent.nom||'—'}<br>
                        ${ent.adresse||''}<br>
                        ${ent.npa||''} ${ent.ville||''}
                    </div>

                    <div style="display:flex;justify-content:space-between;margin-top:4mm;">
                        <div>
                            <div style="font-size:7pt;font-weight:bold;color:#666;">Monnaie</div>
                            <div style="font-size:9pt;font-weight:bold;">CHF</div>
                        </div>
                        <div>
                            <div style="font-size:7pt;font-weight:bold;color:#666;">Montant</div>
                            <div style="font-size:11pt;font-weight:bold;">${fmt(f.montant_ttc)}</div>
                        </div>
                    </div>

                    <div style="margin-top:4mm;font-size:7pt;color:#666;">Point de dépôt</div>
                    <div style="border:1px solid #000;height:12mm;margin-top:1mm;"></div>
                </div>

                <!-- Partie droite: Section de paiement -->
                <div style="flex:1;padding:5mm;font-size:8pt;">
                    <div style="display:flex;gap:5mm;">
                        <!-- QR Code -->
                        <div style="position:relative;display:inline-block;line-height:0;">
                            <img src="${qrBillBase64}" style="width:140px;height:140px;" alt="QR Bill">
                            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:21.3px;height:21.3px;background:#fff;display:flex;align-items:center;justify-content:center;">
                                <div style="position:relative;width:18.3px;height:18.3px;background:#000;">
                                    <div style="position:absolute;left:7.37px;top:3.22px;width:3.57px;height:11.87px;background:#fff;"></div>
                                    <div style="position:absolute;left:3.22px;top:7.37px;width:11.87px;height:3.57px;background:#fff;"></div>
                                </div>
                            </div>
                            <div style="font-size:7pt;text-align:center;margin-top:1mm;color:#666;">QR-IBAN</div>
                        </div>

                        <!-- Infos droite -->
                        <div style="flex:1;">
                            <div style="font-size:7pt;font-weight:bold;color:#666;margin-bottom:1mm;">Compte / Payable à</div>
                            <div style="margin-bottom:3mm;">
                                <strong>CH95 3000 5291 1478 8940 K</strong><br>
                                Didier Gysling / Colixo<br>
                                Impasse des Griottes 3<br>
                                Yverdon-les-Bains<br>
                                1400 Yverdon-les-Bains
                            </div>

                            <div style="font-size:7pt;font-weight:bold;color:#666;margin-bottom:1mm;">Référence</div>
                            <div style="margin-bottom:3mm;font-family:monospace;font-size:9pt;">${qrRef}</div>

                            <div style="font-size:7pt;font-weight:bold;color:#666;margin-bottom:1mm;">Informations supplémentaires</div>
                            <div style="margin-bottom:3mm;font-size:8pt;">Facture ${f.numero} — Période ${new Date(f.periode_debut).toLocaleDateString('fr-CH',{day:'2-digit',month:'2-digit',year:'numeric'})} au ${new Date(f.periode_fin).toLocaleDateString('fr-CH',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>

                            <div style="font-size:7pt;font-weight:bold;color:#666;margin-bottom:1mm;">Payable par</div>
                            <div style="margin-bottom:3mm;">
                                ${ent.nom||'—'}<br>
                                ${ent.adresse||''}<br>
                                ${ent.npa||''} ${ent.ville||''}
                            </div>
                        </div>
                    </div>

                    <!-- Montant -->
                    <div style="display:flex;gap:20mm;margin-top:2mm;">
                        <div>
                            <div style="font-size:7pt;font-weight:bold;color:#666;">Monnaie</div>
                            <div style="font-size:10pt;font-weight:bold;">CHF</div>
                        </div>
                        <div>
                            <div style="font-size:7pt;font-weight:bold;color:#666;">Montant</div>
                            <div style="font-size:14pt;font-weight:bold;">${fmt(f.montant_ttc)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>` + (forEmail ? '' : '\n\n\n        ' + printButtons) + '\n        </body></html>';
    }
window.ColixoFactureDoc={loadQRLib,generateQrBillBase64ForFacture,buildFactureHtmlDocument};})();
